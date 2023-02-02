/** @type import('hardhat/config').HardhatUserConfig */
const dotenv = require("dotenv");
dotenv.config({ path: __dirname + "/.env" });

require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");

const DEFAULT_COMPILER_SETTINGS = {
    version: '0.7.6',
    settings: {
        evmVersion: 'istanbul',
        optimizer: {
            enabled: true,
            runs: 1_000_000,
        },
        metadata: {
            bytecodeHash: 'none',
        },
    },
}

module.exports = {
    defaultNetwork: 'hardhat',
    solidity: {
        compilers: [
            {
                version: "0.8.13",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 4294967295,
                    },
                },
            },
            {
                version: "0.6.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 4294967295,
                    },
                },
            },
            {
                version: '0.7.6',
                settings: {
                    evmVersion: 'istanbul',
                    optimizer: {
                        enabled: true,
                        runs: 1_000_000,
                    },
                    metadata: {
                        bytecodeHash: 'none',
                    },
                },
            }
        ],
        overrides: {
            '@uniswap/v3-periphery/contracts/base/Multicall.sol': DEFAULT_COMPILER_SETTINGS,
            '@uniswap/v3-periphery/contracts/base/PeripheryImmutableState.sol': DEFAULT_COMPILER_SETTINGS,
            '@uniswap/v3-core/contracts/libraries/TickMath.sol': DEFAULT_COMPILER_SETTINGS,
            '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol': DEFAULT_COMPILER_SETTINGS
        }
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: true,
        strict: true,
        only: [],
    }
};
