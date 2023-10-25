const { ethers } = require("hardhat");
const { bn, numberToWei } = require("./utilities");
const { ensureERC1820 } = require("./hardhat-erc1820");

const opts = {
    gasLimit: 30000000
}
const pe = (x) => ethers.utils.parseEther(String(x));

function encodeSqrtX96(reserve1, reserve0) {
    return bn((Math.sqrt(reserve1 / reserve0) * 10 ** 12).toFixed(0))
        .mul(bn(2).pow(96))
        .div(10 ** 12)
}

// ETH = 1500 BUSD
async function scenario01() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const signer = owner;
    // weth test
    const compiledWETH = require("canonical-weth/build/contracts/WETH9.json")
    const WETH = await new ethers.ContractFactory(compiledWETH.abi, compiledWETH.bytecode, signer);
    // uniswap factory
    const compiledUniswapFactory = require("@uniswap/v2-core/build/UniswapV2Factory.json");
    const UniswapFactory = await new ethers.ContractFactory(compiledUniswapFactory.interface, compiledUniswapFactory.bytecode, signer);
    // uniswap router
    const compiledUniswapRouter = require("@uniswap/v2-periphery/build/UniswapV2Router02");
    const UniswapRouter = await new ethers.ContractFactory(compiledUniswapRouter.abi, compiledUniswapRouter.bytecode, signer);
    // erc20 factory
    const compiledERC20 = require("@uniswap/v2-core/build/ERC20.json");
    const erc20Factory = new ethers.ContractFactory(compiledERC20.abi, compiledERC20.bytecode, signer);
    // setup uniswap
    const busd = await erc20Factory.deploy(numberToWei(100000000));
    const weth = await WETH.deploy();
    const uniswapFactory = await UniswapFactory.deploy(busd.address);
    const uniswapRouter = await UniswapRouter.deploy(uniswapFactory.address, weth.address);
    await busd.approve(uniswapRouter.address, ethers.constants.MaxUint256);
    await uniswapRouter.addLiquidityETH(
        busd.address,
        '10480444925500000000000000',
        '10480444925000000000000000',
        '6986963283651477901852',
        owner.address,
        new Date().getTime() + 100000,
        {
            value: '6986963283651477901852',
            gasLimit: 30000000
        }
    );
    const pairAddresses = await uniswapFactory.allPairs(0);
    const uniswapPool = new ethers.Contract(pairAddresses, require("@uniswap/v2-core/build/UniswapV2Pair.json").abi, signer);

    // deploy UniversalRouter
    const UniversalRouter = await ethers.getContractFactory("UniversalTokenRouter");
    const utr = await UniversalRouter.deploy();
    await utr.deployed();

    // deploy helper
    const UniswapV2Helper01 = await ethers.getContractFactory("UniswapV2Helper01");
    const uniswapV2Helper01 = await UniswapV2Helper01.deploy(
        uniswapFactory.address,
        weth.address,
        utr.address
    );
    await uniswapV2Helper01.deployed();

    // deploy WethAdapter
    const WethAdapter = await ethers.getContractFactory("WethAdapter");
    const wethAdapter = await WethAdapter.deploy(
        weth.address
    );
    await wethAdapter.deployed();

    // deploy nft721
    const GameItem = await ethers.getContractFactory("GameItem");
    const gameItem = await GameItem.deploy();
    await gameItem.deployed();

    // deploy nft721
    const GameController = await ethers.getContractFactory("GameController");
    const gameController = await GameController.deploy(gameItem.address);
    await gameController.deployed();
    
    // deploy nft1155
    const GameItems = await ethers.getContractFactory("GameItems");
    const gameItems = await GameItems.deploy();
    await gameItems.deployed();

    // deploy erc777
    await ensureERC1820(hre.network.provider)
    const GLDToken = await ethers.getContractFactory("GLDToken");
    const gldToken = await GLDToken.deploy(1000, [owner.address]);
    await gldToken.deployed();

    // deploy AllowanceAdapter
    const AllowanceAdapter = await ethers.getContractFactory("AllowanceAdapter");
    const adapter = await AllowanceAdapter.deploy();
    await adapter.deployed();

    // uniswap factory
    const compiledUniswapv3Factory = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
    const Uniswapv3Factory = new ethers.ContractFactory(compiledUniswapv3Factory.abi, compiledUniswapv3Factory.bytecode, signer);
    // uniswap router
    const compiledUniswapv3Router = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
    const Uniswapv3Router = new ethers.ContractFactory(compiledUniswapv3Router.abi, compiledUniswapv3Router.bytecode, signer);
    // uniswap position manager
    const compiledUniswapv3PositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
    const Uniswapv3PositionManager = new ethers.ContractFactory(compiledUniswapv3PositionManager.abi, compiledUniswapv3PositionManager.bytecode, signer);
    
    const usdc = await erc20Factory.deploy(numberToWei(100000000));

    const uniswapv3Factory = await Uniswapv3Factory.deploy();
    const uniswapv3Router = await Uniswapv3Router.deploy(uniswapv3Factory.address, weth.address);
    const uniswapv3PositionManager = await Uniswapv3PositionManager.deploy(uniswapv3Factory.address, weth.address, '0x0000000000000000000000000000000000000000')
    await uniswapv3Factory.createPool(usdc.address, weth.address, 500)

    const compiledUniswapPool = require("../compiled/UniswapV3Pool.json");
    const poolAddress = await uniswapv3Factory.getPool(usdc.address, weth.address, 500)
    const uniswapPair = new ethers.Contract(poolAddress, compiledUniswapPool.abi, signer);
    
    await usdc.approve(uniswapv3PositionManager.address, ethers.constants.MaxUint256);
    await weth.approve(uniswapv3PositionManager.address, ethers.constants.MaxUint256);

    const quoteTokenIndex = weth.address.toLowerCase() < usdc.address.toLowerCase() ? 1 : 0
    const initPriceX96 = encodeSqrtX96(quoteTokenIndex ? 1500 : 1, quoteTokenIndex ? 1 : 1500)
    const a = await uniswapPair.initialize(initPriceX96)
    a.wait(1);
    // await time.increase(1000);
    // await uniswapv3PositionManager.createAndInitializePoolIfNecessary(
    //     usdc.address,
    //     weth.address,
    //     3000,
    //     bn('1').mul(bn(2).pow(96)).div('1500'),
    //     opts
    // )
    await uniswapv3PositionManager.mint({
        token0: quoteTokenIndex ? weth.address : usdc.address,
        token1: quoteTokenIndex ? usdc.address : weth.address,
        fee: 500,
        tickLower: Math.ceil(-887272 / 10) * 10,
        tickUpper: Math.floor(887272 / 10) * 10,
        amount0Desired: quoteTokenIndex ? pe('100') : pe('150000'),
        amount1Desired: quoteTokenIndex ? pe('150000') : pe('100'),
        amount0Min: 0,
        amount1Min: 0,
        recipient: owner.address,
        deadline: new Date().getTime() + 100000
    }, {
        value: pe('100'),
        gasLimit: 30000000
    })
    // deploy helper
    const UniswapV3Helper = await ethers.getContractFactory("SwapHelper");
    const uniswapV3Helper = await UniswapV3Helper.deploy(
        uniswapv3Factory.address,
        weth.address,
        utr.address
    );
    await uniswapV3Helper.deployed();

    // deploy PaymentTest
    const PaymentTest = await ethers.getContractFactory("PaymentTest");
    const paymentTest = await PaymentTest.deploy(
        utr.address
    );
    await paymentTest.deployed();

    return {
        uniswapRouter,
        utr,
        adapter,
        uniswapPool,
        uniswapV2Helper01,
        wethAdapter,
        gameController,
        gameItem,
        gameItems,
        gldToken,
        busd,
        weth,
        owner,
        otherAccount,
        poolAddress,
        uniswapV3Helper,
        uniswapv3PositionManager,
        uniswapv3Router,
        usdc,
        paymentTest,
        erc20Factory
    }
}

module.exports = {
    scenario01,
}