// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Kuru Flow entrypoint. Output is paid to `receiver`, never chosen by the delegate.
/// @dev Matches KuruFlowEntrypoint.executeSwapWithReceiver.
interface IKuruFlowEntrypoint {
    struct SwapIntent {
        address tokenUserBuys;
        uint256 minAmountUserBuys;
        address tokenUserSells;
        uint256 amountUserSells;
    }

    struct FeeCollection {
        address feeCollectorAddress;
        uint256 feeBps;
        address referrerAddress;
        uint256 referrerFeeBps;
        bool isInTokenFee;
    }

    function executeSwapWithReceiver(
        SwapIntent calldata swapIntent,
        FeeCollection calldata feeCollection,
        bytes calldata program,
        address receiver
    ) external payable returns (uint256 amountOut);
}

/// @title KuruDelegatedSpend
/// @notice Owner custody for one Monad venue: Kuru Flow.
///         The delegate may swap only through the pinned entrypoint, only on pairs the
///         owner allowed, and only up to the owner's cap. Output stays in this contract.
contract KuruDelegatedSpend is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);

    address public owner;
    address public delegate;
    address public entrypoint;
    uint256 public epoch;

    struct Budget {
        uint256 remaining;
        uint256 perTxCap;
        uint64 validUntil;
        uint256 epoch;
        bool active;
    }

    mapping(address tokenIn => Budget) public budgets;
    mapping(address tokenIn => mapping(address tokenOut => bool)) public pairAllowed;

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

    event DelegateSet(address indexed delegate);
    event EntrypointSet(address indexed entrypoint);
    event PairSet(address indexed tokenIn, address indexed tokenOut, bool allowed);
    event BudgetSet(address indexed token, uint256 remaining, uint256 perTxCap, uint64 validUntil, uint256 epoch);
    event Revoked(uint256 epoch);
    event Spent(
        address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 epoch
    );
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address owner_, address delegate_, address entrypoint_) {
        if (owner_ == address(0) || entrypoint_ == address(0)) revert ZeroAddress();
        owner = owner_;
        delegate = delegate_;
        entrypoint = entrypoint_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setDelegate(address next) external onlyOwner {
        delegate = next;
        emit DelegateSet(next);
    }

    function setEntrypoint(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        entrypoint = next;
        emit EntrypointSet(next);
    }

    function setPair(address tokenIn, address tokenOut, bool allowed) external onlyOwner {
        if (tokenIn == tokenOut) revert SameToken();
        pairAllowed[tokenIn][tokenOut] = allowed;
        emit PairSet(tokenIn, tokenOut, allowed);
    }

    /// @param validUntil Unix time. Zero means the budget does not expire.
    function setBudget(address token, uint256 remaining, uint256 perTxCap, uint64 validUntil) external onlyOwner {
        if (perTxCap == 0 || remaining == 0) revert ZeroAmount();
        budgets[token] = Budget({remaining: remaining, perTxCap: perTxCap, validUntil: validUntil, epoch: epoch, active: true});
        emit BudgetSet(token, remaining, perTxCap, validUntil, epoch);
    }

    /// @notice Invalidates every budget. The owner must call setBudget again before the delegate can spend.
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

    /// @notice Swap `amountIn` of `tokenIn` for at least `minAmountOut` of `tokenOut`.
    ///         `program` is the Kuru Flow route bytes. Fees are forced to zero.
    function spend(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata program)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        if (msg.sender != delegate || delegate == address(0)) revert NotDelegate();
        if (msg.value != 0) revert UnexpectedValue();
        if (tokenIn == tokenOut) revert SameToken();
        if (amountIn == 0 || minAmountOut == 0) revert ZeroAmount();
        if (entrypoint == address(0)) revert ZeroAddress();
        if (!pairAllowed[tokenIn][tokenOut]) revert PairNotAllowed();

        Budget storage budget = budgets[tokenIn];
        if (!budget.active || budget.epoch != epoch) revert NoBudget();
        if (budget.validUntil != 0 && block.timestamp > budget.validUntil) revert Expired();
        if (amountIn > budget.perTxCap || amountIn > budget.remaining) revert OverCap();
        if (_balance(tokenIn) < amountIn) revert OverCap();

        budget.remaining -= amountIn;

        IKuruFlowEntrypoint.SwapIntent memory intent = IKuruFlowEntrypoint.SwapIntent({
            tokenUserBuys: tokenOut,
            minAmountUserBuys: minAmountOut,
            tokenUserSells: tokenIn,
            amountUserSells: amountIn
        });
        IKuruFlowEntrypoint.FeeCollection memory fees = IKuruFlowEntrypoint.FeeCollection({
            feeCollectorAddress: address(0),
            feeBps: 0,
            referrerAddress: address(0),
            referrerFeeBps: 0,
            isInTokenFee: true
        });

        uint256 beforeOut = _balance(tokenOut);
        if (tokenIn == NATIVE) {
            amountOut = IKuruFlowEntrypoint(entrypoint)
                .executeSwapWithReceiver{value: amountIn}(intent, fees, program, address(this));
        } else {
            IERC20(tokenIn).forceApprove(entrypoint, amountIn);
            amountOut = IKuruFlowEntrypoint(entrypoint).executeSwapWithReceiver(intent, fees, program, address(this));
            IERC20(tokenIn).forceApprove(entrypoint, 0);
        }

        uint256 gained = _balance(tokenOut) - beforeOut;
        if (gained < minAmountOut) revert Slippage();

        emit Spent(tokenIn, tokenOut, amountIn, amountOut, epoch);
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
