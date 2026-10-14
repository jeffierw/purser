// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPurserAdapter} from "./IPurserAdapter.sol";
import {IUniswapV4PoolManager, IUniswapV4UnlockCallback} from "./IUniswapV4PoolManager.sol";

/// @notice Exact-input swap on one immutable Uniswap v4 PoolManager.
///         Hooks are always address(0). `data` is only `(fee, tickSpacing)`.
///         The pool id commits those fields, so a hooked pool cannot be selected.
contract UniswapV4Adapter is IPurserAdapter, IUniswapV4UnlockCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);
    /// @dev TickMath.MIN_SQRT_PRICE + 1 and MAX_SQRT_PRICE - 1.
    uint160 internal constant MIN_SQRT_PRICE_LIMIT = 4295128740;
    uint160 internal constant MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341;

    IUniswapV4PoolManager public immutable poolManager;

    struct Fill {
        address vault;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint24 fee;
        int24 tickSpacing;
    }

    error ZeroAddress();
    error BadRoute();
    error NotPoolManager();
    error UnexpectedValue();
    error UnexpectedDelta();
    error SweepFailed();

    constructor(address poolManager_) {
        if (poolManager_ == address(0) || poolManager_.code.length == 0) revert ZeroAddress();
        poolManager = IUniswapV4PoolManager(poolManager_);
    }

    /// @inheritdoc IPurserAdapter
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (data.length != 64) revert BadRoute();
        (uint24 fee, int24 tickSpacing) = abi.decode(data, (uint24, int24));
        if (fee == 0 || fee > 100_000 || tickSpacing <= 0) revert BadRoute();

        address vault = msg.sender;
        if (tokenIn == NATIVE) {
            if (msg.value != amountIn) revert UnexpectedValue();
        } else {
            if (msg.value != 0) revert UnexpectedValue();
            IERC20(tokenIn).safeTransferFrom(vault, address(this), amountIn);
        }

        bytes memory result = poolManager.unlock(
            abi.encode(Fill({vault: vault, tokenIn: tokenIn, tokenOut: tokenOut, amountIn: amountIn, minAmountOut: minAmountOut, fee: fee, tickSpacing: tickSpacing}))
        );
        amountOut = abi.decode(result, (uint256));

        _sweep(tokenIn, vault);
        if (tokenOut != tokenIn) _sweep(tokenOut, vault);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        Fill memory fill = abi.decode(data, (Fill));
        (int128 inputDelta, int128 outputDelta) = _deltas(fill);
        if (inputDelta >= 0 || outputDelta <= 0) revert UnexpectedDelta();

        uint256 paid = uint256(uint128(-inputDelta));
        uint256 gained = uint256(uint128(outputDelta));
        if (paid == 0 || paid > fill.amountIn || gained < fill.minAmountOut) revert UnexpectedDelta();

        _settle(fill.tokenIn, paid);
        _take(fill.tokenOut, fill.vault, gained);
        return abi.encode(gained);
    }

    function _deltas(Fill memory fill) internal returns (int128 inputDelta, int128 outputDelta) {
        (address currency0, address currency1) =
            fill.tokenIn < fill.tokenOut ? (fill.tokenIn, fill.tokenOut) : (fill.tokenOut, fill.tokenIn);
        bool zeroForOne = fill.tokenIn == currency0;
        int256 delta = poolManager.swap(
            IUniswapV4PoolManager.PoolKey({
                currency0: currency0,
                currency1: currency1,
                fee: fill.fee,
                tickSpacing: fill.tickSpacing,
                hooks: address(0)
            }),
            IUniswapV4PoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(fill.amountIn),
                sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT
            }),
            ""
        );
        int128 amount0 = int128(delta >> 128);
        int128 amount1 = int128(delta);
        if (zeroForOne) return (amount0, amount1);
        return (amount1, amount0);
    }

    function _settle(address currency, uint256 amount) internal {
        if (currency == NATIVE) {
            poolManager.settle{value: amount}();
            return;
        }
        poolManager.sync(currency);
        IERC20(currency).safeTransfer(address(poolManager), amount);
        poolManager.settle();
    }

    function _take(address currency, address to, uint256 amount) internal {
        poolManager.take(currency, to, amount);
    }

    function _sweep(address token, address vault) internal {
        if (token == NATIVE) {
            uint256 leftover = address(this).balance;
            if (leftover == 0) return;
            (bool ok,) = vault.call{value: leftover}("");
            if (!ok) revert SweepFailed();
            return;
        }

        uint256 leftoverToken = IERC20(token).balanceOf(address(this));
        if (leftoverToken != 0) IERC20(token).safeTransfer(vault, leftoverToken);
    }

    receive() external payable {}
}
