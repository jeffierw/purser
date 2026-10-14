// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PurserFactory} from "../src/PurserFactory.sol";

/// @notice Deploys the factory against the adapters already on Monad testnet.
///         Each person then calls open() and pays their own gas.
contract DeployFactory is Script {
    address internal constant KURU_ADAPTER = 0xe83966d66bed9b25E70D5eD9983AC2Ac8Dd98AAD;
    address internal constant UNISWAP_ADAPTER = 0xe261dA432030A67C28d6a99b4aA7ed03A243A8d4;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        PurserFactory factory = new PurserFactory(KURU_ADAPTER, UNISWAP_ADAPTER);
        vm.stopBroadcast();
        console2.log("factory", address(factory));
    }
}
