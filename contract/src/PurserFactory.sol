// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PurserStrongbox} from "./PurserStrongbox.sol";

/// @title PurserFactory
/// @notice Anyone opens one strongbox they own. The two Monad testnet adapters are shared and already pinned.
///         The opener pays the gas. A later agent is recorded here so that address can find the box at login.
contract PurserFactory {
    address public immutable kuruClobAdapter;
    address public immutable uniswapAdapter;

    mapping(address owner => address strongbox) public strongboxOf;
    mapping(address delegate => address strongbox) public strongboxByDelegate;
    mapping(address strongbox => address delegate) public indexedDelegate;

    error ZeroAddress();
    error AlreadyOpened();
    error NoStrongbox();

    event StrongboxOpened(address indexed owner, address indexed strongbox, address indexed delegate);
    event DelegateLinked(address indexed strongbox, address indexed delegate);

    constructor(address kuruClobAdapter_, address uniswapAdapter_) {
        if (kuruClobAdapter_.code.length == 0 || uniswapAdapter_.code.length == 0) revert ZeroAddress();
        kuruClobAdapter = kuruClobAdapter_;
        uniswapAdapter = uniswapAdapter_;
    }

    /// @param delegate_ Pass zero to make the opener the agent as well.
    function open(address delegate_) external returns (address strongbox) {
        if (strongboxOf[msg.sender] != address(0)) revert AlreadyOpened();
        strongbox = address(new PurserStrongbox(msg.sender, delegate_, address(0), kuruClobAdapter, uniswapAdapter));
        strongboxOf[msg.sender] = strongbox;
        _indexDelegate(strongbox, PurserStrongbox(payable(strongbox)).delegate());
        emit StrongboxOpened(msg.sender, strongbox, PurserStrongbox(payable(strongbox)).delegate());
    }

    /// @notice After the owner changes the agent on their box, record the new address for login.
    function linkDelegate() external {
        address strongbox = strongboxOf[msg.sender];
        if (strongbox == address(0)) revert NoStrongbox();
        address current = PurserStrongbox(payable(strongbox)).delegate();
        _indexDelegate(strongbox, current);
        emit DelegateLinked(strongbox, current);
    }

    function _indexDelegate(address strongbox, address current) internal {
        address previous = indexedDelegate[strongbox];
        if (previous != address(0) && previous != current && strongboxByDelegate[previous] == strongbox) {
            delete strongboxByDelegate[previous];
        }
        strongboxByDelegate[current] = strongbox;
        indexedDelegate[strongbox] = current;
    }
}
