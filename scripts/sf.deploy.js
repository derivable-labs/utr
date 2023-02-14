const hre = require("hardhat");
require('dotenv').config();

const opts = {
    gasLimit: 30000000
};
async function main() {
    const initCodeUTR = require('../build/UniversalTokenRouter.json').bytecode;
    const salt = 0;
    const saltHash = ethers.utils.keccak256(salt);
    const SingletonFactoryABI = require('./abi/SingletonFactoryABI.json');
    // mainnet
    const url = "https://bsc-dataseed.binance.org/"
    // Connect to the network
    const provider = new hre.ethers.providers.JsonRpcProvider(url);
    const singletonFactoryAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f";
    const contract = new hre.ethers.Contract(singletonFactoryAddress, SingletonFactoryABI, provider);
    const wallet = new hre.ethers.Wallet(process.env.MAINNET_DEPLOYER, provider);
    const contractWithSigner = contract.connect(wallet);

    try {
        const deployTx = await contractWithSigner.deploy(initCodeUTR, saltHash, opts);
        console.log("Result of deploy: ", deployTx);
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