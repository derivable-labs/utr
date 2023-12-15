const hre = require("hardhat");
const ethers = hre.ethers

async function main() {
    const initCodeUTR = require('../artifacts/contracts/UniversalTokenRouter.sol/UniversalTokenRouter.json').bytecode;
    const salt = 0
    const saltHex = ethers.utils.hexZeroPad(ethers.utils.hexlify(salt), 32)
    const SingletonFactoryABI = require('./abi/SingletonFactoryABI.json');
    const { url, accounts } = hre.network.config
    const gasPrice = hre.network.config.gasPrice != 'auto' ? hre.network.config.gasPrice : undefined
    const gasLimit = hre.network.config.gasLimit != 'auto' ? hre.network.config.gasLimit : undefined
    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(url);
    const singletonFactoryAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f";
    const contract = new ethers.Contract(singletonFactoryAddress, SingletonFactoryABI, provider);
    const wallet = new ethers.Wallet(accounts[0], provider);
    const contractWithSigner = contract.connect(wallet);

    try {
        const deployTx = await contractWithSigner.deploy(
            initCodeUTR,
            saltHex,
            {gasLimit, gasPrice}
        );
        console.log("Tx: ", deployTx.hash);
        const res = await deployTx.wait(1)
        console.log("Result: ", res)
    } catch (error) {
        console.log("Error: ", error.error ?? error)
    }
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});