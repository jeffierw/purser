// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {KuruDelegatedSpend, IKuruFlowEntrypoint} from "../src/KuruDelegatedSpend.sol";
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

contract KuruDelegatedSpendTest is Test {
    KuruDelegatedSpend wallet;
    MockKuruEntrypoint kuru;
    MockERC20 tokenIn;
    MockERC20 usdc;

    address owner = makeAddr("owner");
    address delegate = makeAddr("delegate");
    address stranger = makeAddr("stranger");

    function setUp() public {
        kuru = new MockKuruEntrypoint();
        tokenIn = new MockERC20("IN");
        usdc = new MockERC20("USDC");
        wallet = new KuruDelegatedSpend(owner, delegate, address(kuru));

        vm.prank(owner);
        wallet.setPair(address(tokenIn), address(usdc), true);
        vm.prank(owner);
        wallet.setBudget(address(tokenIn), 100 ether, 40 ether, 0);

        tokenIn.mint(owner, 100 ether);
        vm.startPrank(owner);
        tokenIn.approve(address(wallet), 100 ether);
        wallet.depositToken(address(tokenIn), 100 ether);
        vm.stopPrank();
    }

    function test_delegateSwapPaysWallet() public {
        vm.prank(delegate);
        uint256 out = wallet.spend(address(tokenIn), address(usdc), 40 ether, 80 ether, hex"0201");

        assertEq(out, 80 ether);
        assertEq(usdc.balanceOf(address(wallet)), 80 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 60 ether);
        assertEq(tokenIn.balanceOf(delegate), 0);
        assertEq(usdc.balanceOf(delegate), 0);
        assertEq(tokenIn.allowance(address(wallet), address(kuru)), 0);
        assertEq(kuru.lastReceiver(), address(wallet));
        (uint256 remaining,,,,) = wallet.budgets(address(tokenIn));
        assertEq(remaining, 60 ether);
    }

    function test_strangerCannotSpend() public {
        vm.prank(stranger);
        vm.expectRevert(KuruDelegatedSpend.NotDelegate.selector);
        wallet.spend(address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_delegateCannotWithdraw() public {
        vm.prank(delegate);
        vm.expectRevert(KuruDelegatedSpend.NotOwner.selector);
        wallet.withdraw(address(tokenIn), 1 ether, delegate);
    }

    function test_overPerTxCap() public {
        vm.prank(delegate);
        vm.expectRevert(KuruDelegatedSpend.OverCap.selector);
        wallet.spend(address(tokenIn), address(usdc), 41 ether, 1, hex"01");
    }

    function test_pairMustBeAllowed() public {
        MockERC20 scam = new MockERC20("SCAM");
        vm.prank(delegate);
        vm.expectRevert(KuruDelegatedSpend.PairNotAllowed.selector);
        wallet.spend(address(tokenIn), address(scam), 1 ether, 1, hex"01");
    }

    function test_revokeAllBlocksSpendUntilReset() public {
        vm.prank(owner);
        wallet.revokeAll();

        vm.prank(delegate);
        vm.expectRevert(KuruDelegatedSpend.NoBudget.selector);
        wallet.spend(address(tokenIn), address(usdc), 1 ether, 1, hex"01");

        vm.prank(owner);
        wallet.setBudget(address(tokenIn), 10 ether, 10 ether, 0);
        vm.prank(delegate);
        wallet.spend(address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_expiry() public {
        vm.prank(owner);
        wallet.setBudget(address(tokenIn), 10 ether, 10 ether, uint64(block.timestamp + 10));
        vm.warp(block.timestamp + 11);
        vm.prank(delegate);
        vm.expectRevert(KuruDelegatedSpend.Expired.selector);
        wallet.spend(address(tokenIn), address(usdc), 1 ether, 1, hex"01");
    }

    function test_nativeIn() public {
        vm.deal(address(wallet), 5 ether);
        vm.startPrank(owner);
        wallet.setPair(address(0), address(usdc), true);
        wallet.setBudget(address(0), 5 ether, 2 ether, 0);
        vm.stopPrank();

        vm.prank(delegate);
        uint256 out = wallet.spend(address(0), address(usdc), 2 ether, 4 ether, hex"03");
        assertEq(out, 4 ether);
        assertEq(usdc.balanceOf(address(wallet)), 4 ether);
        assertEq(address(wallet).balance, 3 ether);
    }

    function test_ownerWithdrawsOutput() public {
        vm.prank(delegate);
        wallet.spend(address(tokenIn), address(usdc), 10 ether, 1, hex"01");
        vm.prank(owner);
        wallet.withdraw(address(usdc), 20 ether, owner);
        assertEq(usdc.balanceOf(owner), 20 ether);
    }

    function test_slippageRevertsAndKeepsBudget() public {
        kuru.setRate(1);
        vm.prank(delegate);
        vm.expectRevert();
        wallet.spend(address(tokenIn), address(usdc), 10 ether, 21 ether, hex"01");
        (uint256 remaining,,,,) = wallet.budgets(address(tokenIn));
        assertEq(remaining, 100 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 100 ether);
    }
}
