const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const expect = chai.expect;
const { ethers } = require("hardhat");
const { bn } = require("./shared/utilities");
const { AddressZero, MaxUint256 } = ethers.constants;
const { scenario02 } = require("./shared/fixtures");

const fe = (x) => Number(ethers.utils.formatEther(x))
const pe = (x) => ethers.utils.parseEther(String(x))

const scenarios = [
    { fixture: scenario02, fixtureName: "(ETH = 1500 BUSD)" },
];

const TRANSFER_FROM_SENDER  = 0;
const TRANSFER_FROM_ROUTER  = 1;
const TRANSFER_CALL_VALUE   = 2;
const ALLOWANCE_CALLBACK    = 0x100;
const ALLOWANCE_BRIDGE      = 0x200;
const AMOUNT_EXACT          = 0;
const AMOUNT_ALL            = 1;
const EIP_ETH               = 0;
const ID_721_ALL = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UniversalTokenRouter.ID_721_ALL"))
const ACTION_IGNORE_ERROR       = 1;
const ACTION_RECORD_CALL_RESULT = 2;
const ACTION_INJECT_CALL_RESULT = 4;

scenarios.forEach(function (scenario) {
    describe("Pool Info: " + scenario.fixtureName, function () {
        describe("Usage Samples", function () {
            it("UniswapV3Router.exactInput", async function () {
                const {usdc, weth, universalRouter, uniswapV3Helper, poolAddress, owner} = await loadFixture(scenario.fixture);
                await weth.approve(universalRouter.address, MaxUint256);
                await weth.deposit({ value: pe(1) });
                
                await universalRouter.exec([{
                    eip: 20,
                    token: usdc.address,
                    id: 0,
                    amountOutMin: 0,
                    recipient: owner.address,
                }], [{
                    inputs: [{
                        mode: ALLOWANCE_CALLBACK,
                        eip: 20,
                        token: weth.address,
                        id: 0,
                        amountSource: AMOUNT_EXACT,
                        amountInMax: '1000',
                        recipient: poolAddress,
                    }],
                    flags: 0,
                    code: uniswapV3Helper.address,
                    data: (await uniswapV3Helper.populateTransaction.exactInput({
                        payer: owner.address,
                        path: encodePath([weth.address, usdc.address], [3000]),
                        recipient: owner.address,
                        deadline: new Date().getTime() + 100000,
                        amountIn: '1000',
                        amountOutMinimum: 0,
                    })).data,
                }])
            });

            it("UniswapV3Router.exactOutput", async function () {
                const {usdc, weth, universalRouter, uniswapV3Helper, poolAddress, owner} = await loadFixture(scenario.fixture);
                await weth.approve(universalRouter.address, MaxUint256);
                await weth.deposit({ value: pe(1) });

                console.log({
                    universalRouter: universalRouter.address,
                    poolAddress: poolAddress,
                    owner: owner.address,
                    usdc: usdc.address,
                    weth: weth.address
                })
                
                await universalRouter.exec([{
                    eip: 20,
                    token: usdc.address,
                    id: 0,
                    amountOutMin: 1,
                    recipient: owner.address,
                }], [{
                    inputs: [{
                        mode: ALLOWANCE_CALLBACK,
                        eip: 20,
                        token: weth.address,
                        id: 0,
                        amountSource: AMOUNT_EXACT,
                        amountInMax: '1600',
                        recipient: poolAddress,
                    }],
                    flags: 0,
                    code: uniswapV3Helper.address,
                    data: (await uniswapV3Helper.populateTransaction.exactOutput({
                        payer: owner.address,
                        path: encodePath([usdc.address, weth.address], [3000]),
                        recipient: owner.address,
                        deadline: new Date().getTime() + 100000,
                        amountOut: '1',
                        amountInMaximum: '1600',
                    })).data,
                }])
            });
        });
    });
});

function encodePath(path, fees) {
    const FEE_SIZE = 3
    if (path.length != fees.length + 1) {
      throw new Error('path/fee lengths do not match')
    }
  
    let encoded = '0x'
    for (let i = 0; i < fees.length; i++) {
      // 20 byte encoding of the address
      encoded += path[i].slice(2)
      // 3 byte encoding of the fee
      encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
    }
    // encode the final token
    encoded += path[path.length - 1].slice(2)
  
    return encoded.toLowerCase()
  }