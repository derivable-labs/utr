const { ethers } = require("hardhat");
const { bn, numberToWei } = require("./utilities");
const opts = {
    gasLimit: 30000000
}
const pe = (x) => ethers.utils.parseEther(String(x));

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
    const universalRouter = await UniversalRouter.deploy();
    await universalRouter.deployed();

    // deploy helper
    const UniswapV2Helper01 = await ethers.getContractFactory("UniswapV2Helper01");
    const uniswapV2Helper01 = await UniswapV2Helper01.deploy(
        uniswapFactory.address,
        weth.address
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

    return {
        uniswapRouter,
        universalRouter,
        uniswapPool,
        uniswapV2Helper01,
        wethAdapter,
        gameItem,
        busd,
        weth,
        owner,
        otherAccount
    }
}

async function scenario02() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const signer = owner;
    // weth test
    const compiledWETH = require("canonical-weth/build/contracts/WETH9.json")
    const WETH = new ethers.ContractFactory(compiledWETH.abi, compiledWETH.bytecode, signer);
    // uniswap factory
    const compiledUniswapFactory = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
    const Uniswapv3Factory = new ethers.ContractFactory(compiledUniswapFactory.abi, compiledUniswapFactory.bytecode, signer);
    // uniswap router
    const compiledUniswapv3Router = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
    const Uniswapv3Router = new ethers.ContractFactory(compiledUniswapv3Router.abi, compiledUniswapv3Router.bytecode, signer);
    // uniswap position manager
    const compiledUniswapv3PositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
    const Uniswapv3PositionManager = new ethers.ContractFactory(compiledUniswapv3PositionManager.abi, compiledUniswapv3PositionManager.bytecode, signer);
    // erc20 factory
    const compiledERC20 = require("@uniswap/v2-core/build/ERC20.json");
    const erc20Factory = new ethers.ContractFactory(compiledERC20.abi, compiledERC20.bytecode, signer);
    // setup uniswap
    const usdc = await erc20Factory.deploy(numberToWei(100000000));
    const weth = await WETH.deploy();
    const uniswapv3Factory = await Uniswapv3Factory.deploy();
    const uniswapv3Router = await Uniswapv3Router.deploy(uniswapv3Factory.address, weth.address);
    const uniswapv3PositionManager = await Uniswapv3PositionManager.deploy(uniswapv3Factory.address, weth.address, '0x0000000000000000000000000000000000000000')
    
    await usdc.approve(uniswapv3PositionManager.address, ethers.constants.MaxUint256);
    await weth.approve(uniswapv3PositionManager.address, ethers.constants.MaxUint256);

    await uniswapv3PositionManager.createAndInitializePoolIfNecessary(
        usdc.address,
        weth.address,
        3000,
        bn('10000000000').mul(bn(2).pow(96)).div('10000000000')
    )
    await uniswapv3PositionManager.mint({
        token0: usdc.address,
        token1: weth.address,
        fee: 3000,
        tickLower: Math.ceil(-887272 / 60) * 60,
        tickUpper: Math.floor(887272 / 60) * 60,
        amount0Desired: '100000000000000000000',
        amount1Desired: '100000000000000000000',
        amount0Min: 0,
        amount1Min: 0,
        recipient: owner.address,
        deadline: new Date().getTime() + 100000
    }, {
        value: '100000000000000000000',
        gasLimit: 30000000
    })

    // deploy UniversalRouter
    const UniversalRouter = await ethers.getContractFactory("UniversalTokenRouter");
    const universalRouter = await UniversalRouter.deploy();
    await universalRouter.deployed();

    // deploy helper
    const UniswapV3Helper = await ethers.getContractFactory("SwapHelper");
    const uniswapV3Helper = await UniswapV3Helper.deploy(
        uniswapv3Factory.address,
        weth.address,
        universalRouter.address
    );
    await uniswapV3Helper.deployed();

    const poolAddress = await uniswapv3Factory.getPool(usdc.address, weth.address, 3000);

    return {
        uniswapv3Router,
        universalRouter,
        uniswapV3Helper,
        usdc,
        weth,
        owner,
        otherAccount,
        poolAddress,
        uniswapv3PositionManager
    }
}

module.exports = {
    scenario01,
    scenario02
}