const hre = require("hardhat");

const opts = {
    gasLimit: 30000000
};
async function main() {
    const UTR = await hre.ethers.getContractFactory("UniversalTokenRouter");
    const utr = await UTR.deploy();
    await utr.deployed();

    console.log(
        `UTR: ${utr.address}`
    );
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});