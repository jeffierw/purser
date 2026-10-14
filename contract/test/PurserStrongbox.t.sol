// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PurserStrongbox} from "../src/PurserStrongbox.sol";
import {KuruFlowAdapter} from "../src/KuruFlowAdapter.sol";
import {IKuruFlowEntrypoint} from "../src/IKuruFlowEntrypoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is IERC20 {
    string public name;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    uint256 public override totalSupply;

    constructor(string memory name_) {
        name = name_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Pulls `amountUserSells` from the caller and pays `receiver`, same as KuruFlowEntrypoint.
contract MockKuruEntrypoint {
    uint256 public rate = 2;
    address public lastReceiver;

    function setRate(uint256 next) external {
        rate = next;
    }

    function executeSwapWithReceiver(
        IKuruFlowEntrypoint.SwapIntent calldata swapIntent,
        IKuruFlowEntrypoint.FeeCollection calldata feeCollection,
        bytes calldata,
        address receiver
    ) external payable returns (uint256 amountOut) {
        require(feeCollection.feeBps == 0 && feeCollection.referrerFeeBps == 0, "fee");
        lastReceiver = receiver;

        if (swapIntent.tokenUserSells == address(0)) {
            require(msg.value == swapIntent.amountUserSells, "value");
        } else {
            require(msg.value == 0, "value");
            IERC20(swapIntent.tokenUserSells).transferFrom(msg.sender, address(this), swapIntent.amountUserSells);
        }

        amountOut = swapIntent.amountUserSells * rate;
        if (amountOut < swapIntent.minAmountUserBuys) revert("slippage");

        if (swapIntent.tokenUserBuys == address(0)) {
            (bool ok,) = receiver.call{value: amountOut}("");
            require(ok, "eth");
        } else {
            MockERC20(swapIntent.tokenUserBuys).mint(receiver, amountOut);
        }
    }

    receive() external payable {}
}

/// @dev A second venue: lock the input and mint share tokens to the caller.
contract MockShareAdapter {
    MockERC20 public immutable share;

    constructor(MockERC20 share_) {
        share = share_;
    }

    function execute(address tokenIn, address, uint256 amountIn, uint256, bytes calldata)
        external
        payable
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn;
        share.mint(msg.sender, amountOut);
    }
}

/// @dev Tries to pull a token the strongbox did not approve.
contract ThiefAdapter {
    address public immutable want;

    constructor(address want_) {
        want = want_;
    }

    function execute(address, address, uint256, uint256, bytes calldata) external payable returns (uint256) {
        IERC20(want).transferFrom(msg.sender, address(this), 1 ether);
        return 1 ether;
    }
}

contract PurserStrongboxTest is Test {
    PurserStrongbox wallet;
    KuruFlowAdapter adapter;
    MockKuruEntrypoint kuru;
    MockERC20 tokenIn;
    MockERC20 usdc;

    address owner = makeAddr("owner");
    address delegate = makeAddr("delegate");
    address stranger = makeAddr("stranger");

    bytes32 kuruAction;

    function setUp() public {
        kuru = new MockKuruEntrypoint();
        adapter = new KuruFlowAdapter(address(kuru));
        tokenIn = new MockERC20("IN");
        usdc = new MockERC20("USDC");
        wallet = new PurserStrongbox(owner, delegate, address(adapter), address(0), address(0));
        kuruAction = wallet.KURU_FLOW_SWAP();

        vm.prank(owner);
        wallet.setPair(kuruAction, address(tokenIn), address(usdc), true);
        vm.prank(owner);
        wallet.setBudget(kuruAction, address(tokenIn), 100 ether, 40 ether, 0);

        tokenIn.mint(owner, 100 ether);
        vm.startPrank(owner);
        tokenIn.approve(address(wallet), 100 ether);
        wallet.depositToken(address(tokenIn), 100 ether);
        vm.stopPrank();
    }

    function test_delegateSwapPaysWallet() public {
        vm.prank(delegate);
        uint256 out = wallet.execute(kuruAction, address(tokenIn), address(usdc), 40 ether, 80 ether, hex"0201");

        assertEq(out, 80 ether);
        assertEq(usdc.balanceOf(address(wallet)), 80 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 60 ether);
        assertEq(tokenIn.balanceOf(delegate), 0);
        assertEq(usdc.balanceOf(delegate), 0);
        assertEq(tokenIn.allowance(address(wallet), address(adapter)), 0);
        assertEq(tokenIn.allowance(address(adapter), address(kuru)), 0);
        assertEq(kuru.lastReceiver(), address(wallet));
        (uint256 remaining,,,,) = wallet.budgets(kuruAction, address(tokenIn));
        assertEq(remaining, 60 ether);
    }

    function test_strangerCannotExecute() public {
        vm.prank(stranger);
        vm.expectRevert(PurserStrongbox.NotDelegate.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_delegateCannotWithdraw() public {
        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.NotOwner.selector);
        wallet.withdraw(address(tokenIn), 1 ether, delegate);
    }

    function test_delegateCannotPinAdapter() public {
        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.NotOwner.selector);
        wallet.setAdapter(keccak256("purser.other.v1"), address(adapter));
    }

    function test_adapterCannotBeReplaced() public {
        vm.prank(owner);
        vm.expectRevert(PurserStrongbox.AdapterLocked.selector);
        wallet.setAdapter(kuruAction, address(adapter));
    }

    function test_overPerTxCap() public {
        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.OverCap.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 41 ether, 1, hex"01");
    }

    function test_pairMustBeAllowed() public {
        MockERC20 scam = new MockERC20("SCAM");
        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.PairNotAllowed.selector);
        wallet.execute(kuruAction, address(tokenIn), address(scam), 1 ether, 1, hex"01");
    }

    function test_revokeOneBudgetLeavesTheOther() public {
        MockERC20 other = new MockERC20("OTHER");
        other.mint(address(wallet), 10 ether);

        vm.startPrank(owner);
        wallet.setPair(kuruAction, address(other), address(usdc), true);
        wallet.setBudget(kuruAction, address(other), 10 ether, 10 ether, 0);
        wallet.revokeBudget(kuruAction, address(tokenIn));
        vm.stopPrank();

        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.NoBudget.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");

        vm.prank(delegate);
        wallet.execute(kuruAction, address(other), address(usdc), 1 ether, 1, hex"01");
    }

    function test_secondVenueKeepsItsOwnBudget() public {
        MockERC20 share = new MockERC20("SHARE");
        MockShareAdapter lending = new MockShareAdapter(share);
        bytes32 lendingAction = keccak256("purser.lending.supply.v1");

        vm.startPrank(owner);
        wallet.setAdapter(lendingAction, address(lending));
        wallet.setPair(lendingAction, address(tokenIn), address(share), true);
        wallet.setBudget(lendingAction, address(tokenIn), 25 ether, 25 ether, 0);
        wallet.revokeBudget(kuruAction, address(tokenIn));
        vm.stopPrank();

        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.NoBudget.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");

        vm.prank(delegate);
        uint256 out = wallet.execute(lendingAction, address(tokenIn), address(share), 10 ether, 10 ether, "");
        assertEq(out, 10 ether);
        assertEq(share.balanceOf(address(wallet)), 10 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 90 ether);
        assertEq(tokenIn.allowance(address(wallet), address(lending)), 0);
    }

    function test_unapprovedTokenCannotBePulled() public {
        usdc.mint(address(wallet), 50 ether);
        ThiefAdapter thief = new ThiefAdapter(address(usdc));
        bytes32 thiefAction = keccak256("purser.thief.v1");

        vm.startPrank(owner);
        wallet.setAdapter(thiefAction, address(thief));
        wallet.setPair(thiefAction, address(tokenIn), address(usdc), true);
        wallet.setBudget(thiefAction, address(tokenIn), 10 ether, 10 ether, 0);
        vm.stopPrank();

        vm.prank(delegate);
        vm.expectRevert();
        wallet.execute(thiefAction, address(tokenIn), address(usdc), 1 ether, 1, "");

        assertEq(usdc.balanceOf(address(wallet)), 50 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 100 ether);
        (uint256 remaining,,,,) = wallet.budgets(thiefAction, address(tokenIn));
        assertEq(remaining, 10 ether);
    }

    function test_disabledActionDoesNotSpend() public {
        vm.prank(owner);
        wallet.setActionEnabled(kuruAction, false);

        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.ActionDisabled.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_revokeAllBlocksSpendUntilReset() public {
        vm.prank(owner);
        wallet.revokeAll();

        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.NoBudget.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");

        vm.prank(owner);
        wallet.setBudget(kuruAction, address(tokenIn), 10 ether, 10 ether, 0);
        vm.prank(delegate);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_expiry() public {
        vm.prank(owner);
        wallet.setBudget(kuruAction, address(tokenIn), 10 ether, 10 ether, uint64(block.timestamp + 10));
        vm.warp(block.timestamp + 11);
        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.Expired.selector);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_nativeIn() public {
        vm.deal(address(wallet), 5 ether);
        vm.startPrank(owner);
        wallet.setPair(kuruAction, address(0), address(usdc), true);
        wallet.setBudget(kuruAction, address(0), 5 ether, 2 ether, 0);
        vm.stopPrank();

        vm.prank(delegate);
        uint256 out = wallet.execute(kuruAction, address(0), address(usdc), 2 ether, 4 ether, hex"03");
        assertEq(out, 4 ether);
        assertEq(usdc.balanceOf(address(wallet)), 4 ether);
        assertEq(address(wallet).balance, 3 ether);
    }

    function test_ownerWithdrawsOutput() public {
        vm.prank(delegate);
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 10 ether, 1, hex"01");
        vm.prank(owner);
        wallet.withdraw(address(usdc), 20 ether, owner);
        assertEq(usdc.balanceOf(owner), 20 ether);
    }

    function test_slippageRevertsAndKeepsBudget() public {
        kuru.setRate(1);
        vm.prank(delegate);
        vm.expectRevert();
        wallet.execute(kuruAction, address(tokenIn), address(usdc), 10 ether, 21 ether, hex"01");
        (uint256 remaining,,,,) = wallet.budgets(kuruAction, address(tokenIn));
        assertEq(remaining, 100 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 100 ether);
    }
}
