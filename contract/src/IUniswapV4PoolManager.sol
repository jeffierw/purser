// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The slice of Uniswap v4 PoolManager this adapter calls.
///         Selectors were checked against the Monad testnet deployment.
interface IUniswapV4PoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    function unlock(bytes calldata data) external returns (bytes memory result);

    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        returns (int256 delta);

    function sync(address currency) external;

    function settle() external payable returns (uint256 paid);

    function take(address currency, address to, uint256 amount) external;
}

interface IUniswapV4UnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}
