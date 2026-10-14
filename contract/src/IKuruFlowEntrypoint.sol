// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
