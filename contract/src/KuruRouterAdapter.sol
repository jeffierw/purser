// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IKuruRouter} from "./IKuruRouter.sol";
import {IPurserAdapter} from "./IPurserAdapter.sol";

/// @notice One hop on one immutable Kuru router.
///         `data` is only a market address. The market must be registered, and its base/quote
///         must be the strongbox pair. Output is swept back to the calling strongbox.
contract KuruRouterAdapter is IPurserAdapter {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);

    IKuruRouter public immutable router;

    error ZeroAddress();
    error BadRoute();
    error UnverifiedMarket();
    error PairMismatch();
    error UnexpectedValue();
    error SweepFailed();

    constructor(address router_) {
        if (router_ == address(0) || router_.code.length == 0) revert ZeroAddress();
        router = IKuruRouter(router_);
    }

    /// @inheritdoc IPurserAdapter
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external payable returns (uint256 amountOut) {
        if (data.length != 32) revert BadRoute();
        address market = abi.decode(data, (address));
        (bool isBuy, bool nativeSend) = _direction(market, tokenIn, tokenOut);
        address vault = msg.sender;

        if (nativeSend) {
            if (msg.value != amountIn) revert UnexpectedValue();
        } else {
            if (msg.value != 0) revert UnexpectedValue();
            IERC20(tokenIn).safeTransferFrom(vault, address(this), amountIn);
            IERC20(tokenIn).forceApprove(address(router), amountIn);
        }

        amountOut = _swap(market, isBuy, nativeSend, tokenIn, tokenOut, amountIn, minAmountOut);

        if (!nativeSend) IERC20(tokenIn).forceApprove(address(router), 0);
        _sweep(tokenIn, vault);
        if (tokenOut != tokenIn) _sweep(tokenOut, vault);
    }

    function _direction(address market, address tokenIn, address tokenOut)
        internal
        view
        returns (bool isBuy, bool nativeSend)
    {
        IKuruRouter.MarketParams memory params = router.verifiedMarket(market);
        if (params.pricePrecision == 0) revert UnverifiedMarket();
        if (tokenIn == params.quoteAssetAddress && tokenOut == params.baseAssetAddress) {
            isBuy = true;
        } else if (tokenIn == params.baseAssetAddress && tokenOut == params.quoteAssetAddress) {
            isBuy = false;
        } else {
            revert PairMismatch();
        }
        nativeSend = tokenIn == NATIVE;
    }

    function _swap(
        address market,
        bool isBuy,
        bool nativeSend,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        address[] memory markets = new address[](1);
        bool[] memory buy = new bool[](1);
        bool[] memory native = new bool[](1);
        markets[0] = market;
        buy[0] = isBuy;
        native[0] = nativeSend;
        return router.anyToAnySwap{value: nativeSend ? amountIn : 0}(
            markets, buy, native, tokenIn, tokenOut, amountIn, minAmountOut
        );
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
