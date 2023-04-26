const { ethers } = require("hardhat")

function scan(initCodeHash, deployerAddress) {
    const salt = 0
    const address = ethers.utils.getCreate2Address(
        deployerAddress,
        ethers.utils.hexZeroPad(ethers.utils.hexlify(salt), 32),
        initCodeHash,
    )
    return address
}

async function main() {
    const initCode = require('../artifacts/contracts/UniversalTokenRouter.sol/UniversalTokenRouter.json').bytecode
    const initCodeHash = ethers.utils.keccak256(initCode)
    const deployerAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f"
    console.log(scan(initCodeHash, deployerAddress))
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
});