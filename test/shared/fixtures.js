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

    return {
        uniswapRouter,
        universalRouter,
        uniswapPool,
        uniswapV2Helper01,
        wethAdapter,
        busd,
        weth,
        owner,
        otherAccount
    }
}

module.exports = {
    scenario01
}