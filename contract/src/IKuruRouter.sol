// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Kuru DEX router. `anyToAnySwap` only calls markets the router has registered.
/// @dev Matches `contracts/interfaces/IRouter.sol` in Kuru-contracts-dex-public.
interface IKuruRouter {
    struct MarketParams {
        uint32 pricePrecision;
        uint96 sizePrecision;
        address baseAssetAddress;
        uint256 baseAssetDecimals;
        address quoteAssetAddress;
        uint256 quoteAssetDecimals;
        uint32 tickSize;
        uint96 minSize;
        uint96 maxSize;
        uint256 takerFeeBps;
        uint256 makerFeeBps;
    }

    function verifiedMarket(address market) external view returns (MarketParams memory);

    function anyToAnySwap(
        address[] calldata marketAddresses,
        bool[] calldata isBuy,
        bool[] calldata nativeSend,
        address debitToken,
        address creditToken,
        uint256 amount,
        uint256 minAmountOut
    ) external payable returns (uint256 amountOut);
}
