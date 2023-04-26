const hre = require("hardhat");
const ethers = hre.ethers
require('dotenv').config();

const opts = {
    gasLimit: 12000000
};
async function main() {
    const initCodeUTR = require('../artifacts/contracts/UniversalTokenRouter.sol/UniversalTokenRouter.json').bytecode;
    // UTR: 0x6120245B546F2F0ce439186cAae8181007366120
    const salt = 0
    const saltHex = ethers.utils.hexZeroPad(ethers.utils.hexlify(salt), 32)
    const SingletonFactoryABI = require('./abi/SingletonFactoryABI.json');
    // bsc
    const url = process.env.ARB_MAINNET_PROVIDER
    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(url);
    const singletonFactoryAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f";
    const contract = new ethers.Contract(singletonFactoryAddress, SingletonFactoryABI, provider);
    const wallet = new ethers.Wallet(process.env.MAINNET_DEPLOYER, provider);
    const contractWithSigner = contract.connect(wallet);

    try {
        const deployTx = await contractWithSigner.deploy(initCodeUTR, saltHex, opts);
        console.log("Tx: ", deployTx.hash);
        const res = await deployTx.wait(1)
        console.log("Result: ", res)
    } catch (error) {
        console.log("Error: ", error)
    }
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});