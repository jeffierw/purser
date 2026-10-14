// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPurserAdapter} from "./IPurserAdapter.sol";

/// @title PurserStrongbox
/// @notice Owner custody. A delegate may act only through adapters the owner has pinned.
///         The delegate chooses an action id and route bytes, never a target contract.
///         Each action has its own budgets. Pulling one leaves the others in force.
contract PurserStrongbox is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);

    /// @dev Kuru Flow on mainnet. Monad testnet does not publish this entrypoint.
    bytes32 public constant KURU_FLOW_SWAP = keccak256("purser.kuru-flow.swap.v1");
    /// @dev Kuru order-book router on Monad testnet. Markets must already be registered on that router.
    bytes32 public constant KURU_CLOB_SWAP = keccak256("purser.kuru-clob.swap.v1");
    /// @dev Uniswap v4 hookless pools. The adapter pins the PoolManager and rejects hook contracts.
    bytes32 public constant UNISWAP_V4_SWAP = keccak256("purser.uniswap-v4.swap.v1");

    address public owner;
    address public delegate;
    uint256 public epoch;

    struct Action {
        address adapter;
        bool enabled;
    }

    struct Budget {
        uint256 remaining;
        uint256 perTxCap;
        uint64 validUntil;
        uint256 epoch;
        bool active;
    }

    mapping(bytes32 actionId => Action) public actions;
    mapping(bytes32 actionId => mapping(address tokenIn => Budget)) public budgets;
    mapping(bytes32 actionId => mapping(address tokenIn => mapping(address tokenOut => bool))) public pairAllowed;

    error NotOwner();
    error NotDelegate();
    error NoBudget();
    error Expired();
    error OverCap();
    error PairNotAllowed();
    error SameToken();
    error UnexpectedValue();
    error ZeroAmount();
    error ZeroAddress();
    error Slippage();
    error AdapterLocked();
    error UnknownAction();
    error ActionDisabled();

    event DelegateSet(address indexed delegate);
    event AdapterSet(bytes32 indexed actionId, address indexed adapter);
    event ActionEnabled(bytes32 indexed actionId, bool enabled);
    event PairSet(bytes32 indexed actionId, address indexed tokenIn, address indexed tokenOut, bool allowed);
    event BudgetSet(
        bytes32 indexed actionId, address indexed token, uint256 remaining, uint256 perTxCap, uint64 validUntil, uint256 epoch
    );
    event Revoked(uint256 epoch);
    event BudgetRevoked(bytes32 indexed actionId, address indexed token, uint256 epoch);
    event Executed(
        bytes32 indexed actionId,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 epoch
    );
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    /// @param delegate_ Zero means the owner is also the agent, so one wallet can use the box alone.
    ///        A factory passes the shared testnet adapters here. `setAdapter` stays owner-only after that.
    constructor(
        address owner_,
        address delegate_,
        address kuruFlowAdapter_,
        address kuruClobAdapter_,
        address uniswapAdapter_
    ) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        delegate = delegate_ == address(0) ? owner_ : delegate_;
        if (kuruFlowAdapter_ != address(0)) _pinAdapter(KURU_FLOW_SWAP, kuruFlowAdapter_);
        if (kuruClobAdapter_ != address(0)) _pinAdapter(KURU_CLOB_SWAP, kuruClobAdapter_);
        if (uniswapAdapter_ != address(0)) _pinAdapter(UNISWAP_V4_SWAP, uniswapAdapter_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setDelegate(address next) external onlyOwner {
        delegate = next;
        emit DelegateSet(next);
    }

    /// @notice Pins a new venue. The adapter address cannot be replaced. Disable it, or register a new action id.
    function setAdapter(bytes32 actionId, address adapter) external onlyOwner {
        _pinAdapter(actionId, adapter);
    }

    function setActionEnabled(bytes32 actionId, bool enabled) external onlyOwner {
        if (actions[actionId].adapter == address(0)) revert UnknownAction();
        actions[actionId].enabled = enabled;
        emit ActionEnabled(actionId, enabled);
    }

    function setPair(bytes32 actionId, address tokenIn, address tokenOut, bool allowed) external onlyOwner {
        if (actions[actionId].adapter == address(0)) revert UnknownAction();
        if (tokenIn == tokenOut) revert SameToken();
        pairAllowed[actionId][tokenIn][tokenOut] = allowed;
        emit PairSet(actionId, tokenIn, tokenOut, allowed);
    }

    /// @param validUntil Unix time. Zero means the budget does not expire.
    function setBudget(bytes32 actionId, address token, uint256 remaining, uint256 perTxCap, uint64 validUntil)
        external
        onlyOwner
    {
        if (actions[actionId].adapter == address(0)) revert UnknownAction();
        if (perTxCap == 0 || remaining == 0) revert ZeroAmount();
        budgets[actionId][token] =
            Budget({remaining: remaining, perTxCap: perTxCap, validUntil: validUntil, epoch: epoch, active: true});
        emit BudgetSet(actionId, token, remaining, perTxCap, validUntil, epoch);
    }

    /// @notice Pulls one grant. Other actions and other tokens keep their budgets.
    function revokeBudget(bytes32 actionId, address token) external onlyOwner {
        budgets[actionId][token].active = false;
        emit BudgetRevoked(actionId, token, epoch);
    }

    /// @notice Invalidates every grant. The owner must call setBudget again before the delegate can act.
    function revokeAll() external onlyOwner {
        epoch += 1;
        emit Revoked(epoch);
    }

    function depositNative() external payable onlyOwner {}

    function depositToken(address token, uint256 amount) external onlyOwner {
        if (token == NATIVE || amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address token, uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0) || amount == 0) revert ZeroAmount();
        _pay(token, to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice Run one pinned action. `data` is interpreted only by that action's adapter.
    ///         The delegate does not attach value and does not choose the adapter address.
    function execute(
        bytes32 actionId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external nonReentrant returns (uint256 gained) {
        if (msg.sender != delegate || delegate == address(0)) revert NotDelegate();
        if (tokenIn == tokenOut) revert SameToken();
        if (amountIn == 0 || minAmountOut == 0) revert ZeroAmount();

        Action storage action = actions[actionId];
        if (action.adapter == address(0)) revert UnknownAction();
        if (!action.enabled) revert ActionDisabled();
        if (!pairAllowed[actionId][tokenIn][tokenOut]) revert PairNotAllowed();

        Budget storage budget = budgets[actionId][tokenIn];
        if (!budget.active || budget.epoch != epoch) revert NoBudget();
        if (budget.validUntil != 0 && block.timestamp > budget.validUntil) revert Expired();
        if (amountIn > budget.perTxCap || amountIn > budget.remaining) revert OverCap();
        if (_balance(tokenIn) < amountIn) revert OverCap();

        uint256 beforeIn = _balance(tokenIn);
        uint256 beforeOut = _balance(tokenOut);
        address adapter = action.adapter;

        if (tokenIn == NATIVE) {
            IPurserAdapter(adapter).execute{value: amountIn}(tokenIn, tokenOut, amountIn, minAmountOut, data);
        } else {
            IERC20(tokenIn).forceApprove(adapter, amountIn);
            IPurserAdapter(adapter).execute(tokenIn, tokenOut, amountIn, minAmountOut, data);
            IERC20(tokenIn).forceApprove(adapter, 0);
        }

        uint256 spent = beforeIn - _balance(tokenIn);
        gained = _balance(tokenOut) - beforeOut;
        if (spent == 0 || spent > amountIn) revert UnexpectedValue();
        if (gained < minAmountOut) revert Slippage();

        budget.remaining -= spent;
        emit Executed(actionId, tokenIn, tokenOut, spent, gained, epoch);
    }

    function _pinAdapter(bytes32 actionId, address adapter) internal {
        if (actionId == bytes32(0) || adapter == address(0) || adapter == address(this)) revert ZeroAddress();
        if (adapter.code.length == 0) revert ZeroAddress();
        if (actions[actionId].adapter != address(0)) revert AdapterLocked();
        actions[actionId] = Action({adapter: adapter, enabled: true});
        emit AdapterSet(actionId, adapter);
    }

    function _balance(address token) internal view returns (uint256) {
        if (token == NATIVE) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    function _pay(address token, address to, uint256 amount) internal {
        if (token == NATIVE) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert UnexpectedValue();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}
