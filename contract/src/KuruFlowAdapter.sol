// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IKuruFlowEntrypoint} from "./IKuruFlowEntrypoint.sol";
import {IPurserAdapter} from "./IPurserAdapter.sol";

/// @notice Swap adapter for one immutable Kuru Flow entrypoint.
///         Fees are zero. The receiver is the calling strongbox. `data` is only the route program.
contract KuruFlowAdapter is IPurserAdapter {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);

    IKuruFlowEntrypoint public immutable entrypoint;

    error ZeroAddress();
    error UnexpectedValue();
    error SweepFailed();

    constructor(address entrypoint_) {
        if (entrypoint_ == address(0) || entrypoint_.code.length == 0) revert ZeroAddress();
        entrypoint = IKuruFlowEntrypoint(entrypoint_);
    }

    /// @inheritdoc IPurserAdapter
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external payable returns (uint256 amountOut) {
        address vault = msg.sender;

        if (tokenIn == NATIVE) {
            if (msg.value != amountIn) revert UnexpectedValue();
        } else {
            if (msg.value != 0) revert UnexpectedValue();
            IERC20(tokenIn).safeTransferFrom(vault, address(this), amountIn);
            IERC20(tokenIn).forceApprove(address(entrypoint), amountIn);
        }

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

        if (tokenIn == NATIVE) {
            amountOut = entrypoint.executeSwapWithReceiver{value: amountIn}(intent, fees, data, vault);
        } else {
            amountOut = entrypoint.executeSwapWithReceiver(intent, fees, data, vault);
            IERC20(tokenIn).forceApprove(address(entrypoint), 0);
        }

        _sweep(tokenIn, vault);
        if (tokenOut != tokenIn) _sweep(tokenOut, vault);
    }

    /// @dev A venue that pays this adapter, or refunds unused input, still ends in the strongbox.
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
