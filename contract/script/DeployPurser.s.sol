// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PurserStrongbox} from "../src/PurserStrongbox.sol";
import {KuruRouterAdapter} from "../src/KuruRouterAdapter.sol";
import {UniswapV4Adapter} from "../src/UniswapV4Adapter.sol";

/// @notice Deploys the strongbox and pins the two Monad testnet venues.
///         The broadcasting key becomes the owner. Set PURSER_DELEGATE to the agent.
///         Addresses are the ones checked against monad-crypto/protocols and eth_getCode.
contract DeployPurser is Script {
    address internal constant KURU_ROUTER = 0x7EFbE105Ca7415dE98F96622173458ac1c054630;
    address internal constant UNISWAP_V4_POOL_MANAGER = 0x451D64ab3b650040d2aE1886602b97ed6eDc643d;

    function run() external {
        address delegate = vm.envAddress("PURSER_DELEGATE");
        uint256 key = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(key);

        vm.startBroadcast(key);
        KuruRouterAdapter kuru = new KuruRouterAdapter(KURU_ROUTER);
        UniswapV4Adapter uniswap = new UniswapV4Adapter(UNISWAP_V4_POOL_MANAGER);
        PurserStrongbox strongbox = new PurserStrongbox(owner, delegate, address(0), address(0), address(0));
        strongbox.setAdapter(strongbox.KURU_CLOB_SWAP(), address(kuru));
        strongbox.setAdapter(strongbox.UNISWAP_V4_SWAP(), address(uniswap));
        vm.stopBroadcast();

        console2.log("strongbox", address(strongbox));
        console2.log("kuruAdapter", address(kuru));
        console2.log("uniswapAdapter", address(uniswap));
    }
}
