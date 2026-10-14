// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice One pinned venue. The strongbox is `msg.sender` and the only funder.
///         `data` is venue-specific route bytes. An adapter must not treat it as an arbitrary call.
interface IPurserAdapter {
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external payable returns (uint256 amountOut);
}
