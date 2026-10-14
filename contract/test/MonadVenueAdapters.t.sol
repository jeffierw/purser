// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PurserStrongbox} from "../src/PurserStrongbox.sol";
import {PurserFactory} from "../src/PurserFactory.sol";
import {KuruRouterAdapter} from "../src/KuruRouterAdapter.sol";
import {UniswapV4Adapter} from "../src/UniswapV4Adapter.sol";
import {IKuruRouter} from "../src/IKuruRouter.sol";
import {IUniswapV4PoolManager} from "../src/IUniswapV4PoolManager.sol";

contract MockERC20 is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    uint256 public override totalSupply;

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

contract MockKuruRouter is IKuruRouter {
    mapping(address => MarketParams) internal _markets;

    function setMarket(address market, address baseAsset, address quoteAsset) external {
        _markets[market] = MarketParams({
            pricePrecision: 1,
            sizePrecision: 1,
            baseAssetAddress: baseAsset,
            baseAssetDecimals: 18,
            quoteAssetAddress: quoteAsset,
            quoteAssetDecimals: 18,
            tickSize: 1,
            minSize: 1,
            maxSize: type(uint96).max,
            takerFeeBps: 0,
            makerFeeBps: 0
        });
    }

    function verifiedMarket(address market) external view returns (MarketParams memory) {
        return _markets[market];
    }

    function anyToAnySwap(
        address[] calldata marketAddresses,
        bool[] calldata,
        bool[] calldata nativeSend,
        address debitToken,
        address creditToken,
        uint256 amount,
        uint256 minAmountOut
    ) external payable returns (uint256 amountOut) {
        require(marketAddresses.length == 1, "markets");
        require(_markets[marketAddresses[0]].pricePrecision > 0, "market");
        if (nativeSend[0]) {
            require(msg.value == amount, "value");
        } else {
            require(msg.value == 0, "value");
            IERC20(debitToken).transferFrom(msg.sender, address(this), amount);
        }
        amountOut = amount * 2;
        require(amountOut >= minAmountOut, "slip");
        if (creditToken == address(0)) {
            (bool ok,) = msg.sender.call{value: amountOut}("");
            require(ok, "eth");
        } else {
            MockERC20(creditToken).mint(msg.sender, amountOut);
        }
    }

    receive() external payable {}
}

contract MockPoolManager is IUniswapV4PoolManager {
    address public lastHooks;
    uint24 public lastFee;

    function unlock(bytes calldata data) external returns (bytes memory result) {
        result = UniswapV4Adapter(payable(msg.sender)).unlockCallback(data);
    }

    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata) external returns (int256 delta) {
        lastHooks = key.hooks;
        lastFee = key.fee;
        require(params.amountSpecified < 0, "exact in");
        uint256 amountIn = uint256(-params.amountSpecified);
        uint256 amountOut = amountIn * 2;
        int128 paid = -int128(uint128(amountIn));
        int128 got = int128(uint128(amountOut));
        if (params.zeroForOne) return _pack(paid, got);
        return _pack(got, paid);
    }

    function sync(address) external {}

    function settle() external payable returns (uint256 paid) {
        return msg.value == 0 ? 1 : msg.value;
    }

    function take(address currency, address to, uint256 amount) external {
        if (currency == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "eth");
        } else {
            MockERC20(currency).mint(to, amount);
        }
    }

    function _pack(int128 amount0, int128 amount1) internal pure returns (int256) {
        return (int256(amount0) << 128) | int256(uint256(uint128(amount1)));
    }

    receive() external payable {}
}

contract MonadVenueAdaptersTest is Test {
    PurserStrongbox wallet;
    MockKuruRouter kuruRouter;
    MockPoolManager pool;
    KuruRouterAdapter kuruAdapter;
    UniswapV4Adapter uniAdapter;
    MockERC20 usdc;
    address market = makeAddr("market");

    address owner = makeAddr("owner");
    address delegate = makeAddr("delegate");

    bytes32 kuruAction;
    bytes32 uniAction;

    function setUp() public {
        kuruRouter = new MockKuruRouter();
        pool = new MockPoolManager();
        kuruAdapter = new KuruRouterAdapter(address(kuruRouter));
        uniAdapter = new UniswapV4Adapter(address(pool));
        usdc = new MockERC20();
        wallet = new PurserStrongbox(owner, delegate, address(0), address(0), address(0));
        kuruAction = wallet.KURU_CLOB_SWAP();
        uniAction = wallet.UNISWAP_V4_SWAP();

        assertEq(kuruAction, 0x7c37602c2e63dc711a8794b98057b9ef1118fd13528f044b0e9e1064ee4cc8ae);
        assertEq(uniAction, 0xfd91107d0462541f1a47749a58d5bdbe9a7ee950c15b5dd73d2859d9291dd22e);

        vm.startPrank(owner);
        wallet.setAdapter(kuruAction, address(kuruAdapter));
        wallet.setAdapter(uniAction, address(uniAdapter));
        vm.stopPrank();
    }

    function test_kuruMarketPaysTheStrongbox() public {
        kuruRouter.setMarket(market, address(0), address(usdc));
        vm.deal(address(wallet), 5 ether);
        vm.prank(owner);
        wallet.setPair(kuruAction, address(0), address(usdc), true);
        vm.prank(owner);
        wallet.setBudget(kuruAction, address(0), 5 ether, 2 ether, 0);

        vm.prank(delegate);
        uint256 out = wallet.execute(kuruAction, address(0), address(usdc), 2 ether, 4 ether, abi.encode(market));

        assertEq(out, 4 ether);
        assertEq(usdc.balanceOf(address(wallet)), 4 ether);
        assertEq(address(wallet).balance, 3 ether);
        assertEq(usdc.balanceOf(delegate), 0);
    }

    function test_kuruRejectsAnUnregisteredMarket() public {
        vm.deal(address(wallet), 2 ether);
        vm.prank(owner);
        wallet.setPair(kuruAction, address(0), address(usdc), true);
        vm.prank(owner);
        wallet.setBudget(kuruAction, address(0), 2 ether, 2 ether, 0);

        vm.prank(delegate);
        vm.expectRevert(KuruRouterAdapter.UnverifiedMarket.selector);
        wallet.execute(kuruAction, address(0), address(usdc), 1 ether, 1, abi.encode(market));
        assertEq(address(wallet).balance, 2 ether);
    }

    function test_kuruRejectsAMismatchedPair() public {
        kuruRouter.setMarket(market, address(usdc), makeAddr("other"));
        vm.deal(address(wallet), 2 ether);
        vm.prank(owner);
        wallet.setPair(kuruAction, address(0), address(usdc), true);
        vm.prank(owner);
        wallet.setBudget(kuruAction, address(0), 2 ether, 2 ether, 0);

        vm.prank(delegate);
        vm.expectRevert(KuruRouterAdapter.PairMismatch.selector);
        wallet.execute(kuruAction, address(0), address(usdc), 1 ether, 1, abi.encode(market));
    }

    function test_uniswapHooklessSwapPaysTheStrongbox() public {
        MockERC20 tokenIn = new MockERC20();
        tokenIn.mint(address(wallet), 10 ether);
        vm.startPrank(owner);
        wallet.setPair(uniAction, address(tokenIn), address(usdc), true);
        wallet.setBudget(uniAction, address(tokenIn), 10 ether, 4 ether, 0);
        vm.stopPrank();

        bytes memory route = abi.encode(uint24(3000), int24(60));
        vm.prank(delegate);
        uint256 out = wallet.execute(uniAction, address(tokenIn), address(usdc), 4 ether, 8 ether, route);

        assertEq(out, 8 ether);
        assertEq(usdc.balanceOf(address(wallet)), 8 ether);
        assertEq(tokenIn.balanceOf(address(wallet)), 6 ether);
        assertEq(tokenIn.balanceOf(delegate), 0);
        assertEq(pool.lastHooks(), address(0));
        assertEq(pool.lastFee(), 3000);
        assertEq(tokenIn.allowance(address(wallet), address(uniAdapter)), 0);
    }

    function test_pullingKuruLeavesTheUniswapGrant() public {
        kuruRouter.setMarket(market, address(0), address(usdc));
        vm.deal(address(wallet), 3 ether);
        MockERC20 tokenIn = new MockERC20();
        tokenIn.mint(address(wallet), 5 ether);

        vm.startPrank(owner);
        wallet.setPair(kuruAction, address(0), address(usdc), true);
        wallet.setBudget(kuruAction, address(0), 3 ether, 1 ether, 0);
        wallet.setPair(uniAction, address(tokenIn), address(usdc), true);
        wallet.setBudget(uniAction, address(tokenIn), 5 ether, 5 ether, 0);
        wallet.revokeBudget(kuruAction, address(0));
        vm.stopPrank();

        vm.prank(delegate);
        vm.expectRevert(PurserStrongbox.NoBudget.selector);
        wallet.execute(kuruAction, address(0), address(usdc), 1 ether, 1, abi.encode(market));

        vm.prank(delegate);
        uint256 out = wallet.execute(
            uniAction, address(tokenIn), address(usdc), 1 ether, 2 ether, abi.encode(uint24(500), int24(10))
        );
        assertEq(out, 2 ether);
        assertEq(address(wallet).balance, 3 ether);
    }

    function test_strangerCannotOpenThePoolCallback() public {
        vm.prank(delegate);
        vm.expectRevert(UniswapV4Adapter.NotPoolManager.selector);
        uniAdapter.unlockCallback("");
    }

    function test_anyoneOpensABoxWithTheSharedAdapters() public {
        PurserFactory factory = new PurserFactory(address(kuruAdapter), address(uniAdapter));
        address sailor = makeAddr("sailor");

        vm.prank(sailor);
        address box = factory.open(address(0));

        PurserStrongbox opened = PurserStrongbox(payable(box));
        assertEq(opened.owner(), sailor);
        assertEq(opened.delegate(), sailor);
        assertEq(factory.strongboxOf(sailor), box);
        assertEq(factory.strongboxByDelegate(sailor), box);

        (address kuru, bool kuruOn) = opened.actions(kuruAction);
        (address uni, bool uniOn) = opened.actions(uniAction);
        assertEq(kuru, address(kuruAdapter));
        assertTrue(kuruOn);
        assertEq(uni, address(uniAdapter));
        assertTrue(uniOn);

        vm.prank(sailor);
        vm.expectRevert(PurserFactory.AlreadyOpened.selector);
        factory.open(address(0));
    }

    function test_ownerCanPointLoginAtANewAgent() public {
        PurserFactory factory = new PurserFactory(address(kuruAdapter), address(uniAdapter));
        address sailor = makeAddr("sailor");
        address agent = makeAddr("agent");

        vm.prank(sailor);
        address box = factory.open(address(0));

        vm.prank(sailor);
        PurserStrongbox(payable(box)).setDelegate(agent);
        vm.prank(sailor);
        factory.linkDelegate();

        assertEq(factory.strongboxByDelegate(agent), box);
        assertEq(factory.strongboxByDelegate(sailor), address(0));
        assertEq(PurserStrongbox(payable(box)).owner(), sailor);
    }
}
