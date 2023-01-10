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
const { scenario01 } = require("./shared/fixtures");

const fe = (x) => Number(ethers.utils.formatEther(x))
const pe = (x) => ethers.utils.parseEther(String(x))

const scenarios = [
    { fixture: scenario01, fixtureName: "(ETH = 1500 BUSD)" },
];

const LAST_INPUT_RESULT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UniversalTokenRouter.LAST_INPUT_RESULT"))

scenarios.forEach(function (scenario) {
    describe("Pool Info: " + scenario.fixtureName, function () {
        describe("Usage Samples", function () {
            it("UniswapRouter.swapExactTokensForTokens", async function () {
                const { universalRouter, uniswapPool, busd, weth, uniswapV2Helper01, owner } = await loadFixture(scenario.fixture);
                await weth.approve(universalRouter.address, MaxUint256);
                await weth.deposit({ value: pe(100) });

                const amountIn = pe(1);
                const amountOutMin = pe(1400);
                const path = [
                    weth.address,
                    busd.address
                ];
                const to = owner.address;
                const deadline = MaxUint256

                await universalRouter.exec([
                    {
                        output: 0,
                        code: AddressZero,
                        data: '0x',
                        tokens: [{
                            eip: 20,
                            adr: path[0],
                            id: 0,
                            offset: 0, // use exact amount specified bellow
                            amount: amountIn,
                            recipient: uniswapPool.address,
                        }],
                    },
                    {
                        output: 1,
                        code: uniswapV2Helper01.address,
                        data: (await uniswapV2Helper01.populateTransaction.swapExactTokensForTokens(
                            amountIn,
                            amountOutMin,
                            path,
                            to,
                            deadline
                        )).data,
                        tokens: [
                            {
                                offset: 0, // balance change verification
                                eip: 20,
                                adr: path[path.length-1],
                                id: 0,
                                amount: amountOutMin,
                                recipient: to,
                            }
                        ],
                    }
                ]);
            });
            it("UniswapRouter.swapTokensForExactTokens", async function () {
                const { universalRouter, uniswapPool, busd, weth, uniswapV2Helper01, owner } = await loadFixture(scenario.fixture);
                await weth.approve(universalRouter.address, MaxUint256);
                await weth.deposit({ value: pe(100) });
                
                const amountOut = pe(1400);
                const path = [
                    weth.address,
                    busd.address
                ];
                const amountInMax = pe(1);
                const to = owner.address;

                await universalRouter.exec([
                    {
                        output: 0,
                        code: uniswapV2Helper01.address,
                        data: (await uniswapV2Helper01.populateTransaction.getAmountsIn(amountOut, path)).data,
                        tokens: [
                            {
                                eip: 20,
                                adr: path[0],
                                id: 0,
                                offset: 64, // first item of getAmountIns result array
                                amount: amountInMax,
                                recipient: to,
                            },
                            {
                                eip: 20,
                                adr: path[0],
                                id: 0,
                                offset: 0, // first item of getAmountIns result array
                                amount: amountInMax,
                                recipient: uniswapPool.address,
                            },
                        ],
                    },
                    // The result of input action’s getAmountIns will replace the LAST_INPUT_RESULT bytes, save the transaction from calculating twice with the same data.
                    {
                        output: 1,
                        code: uniswapV2Helper01.address,
                        data: (await uniswapV2Helper01.populateTransaction.swap(path, to, LAST_INPUT_RESULT)).data,
                        tokens: [{
                            offset: 0, // balance change verification
                            eip: 20,
                            adr: path[path.length-1],
                            id: 0,
                            amount: amountOut,
                            recipient: to,
                        }],
                    }
                ]);
            });
            it("UniswapRouter.addLiquidity", async function () {
                const { universalRouter, uniswapPool, busd, weth, uniswapV2Helper01, owner } = await loadFixture(scenario.fixture);
                await weth.approve(universalRouter.address, MaxUint256);
                await weth.deposit({ value: pe(100) });
                await busd.approve(universalRouter.address, MaxUint256);

                const tokenA = busd.address;
                const tokenB = weth.address;
                const amountADesired = pe(1500);
                const amountBDesired = pe(1);
                const amountAMin = pe(0);
                const amountBMin = pe(0);
                const to = owner.address;

                await universalRouter.exec([
                    {
                        output: 0,
                        code: uniswapV2Helper01.address,
                        data: (await uniswapV2Helper01.populateTransaction._addLiquidity(
                            tokenA,
                            tokenB,
                            amountADesired,
                            amountBDesired,
                            amountAMin,
                            amountBMin,
                        )).data,
                        tokens: [{
                            eip: 20,
                            adr: tokenA,
                            id: 0,
                            offset: 32,             // first item of _addLiquidity results
                            amount: amountADesired, // amountInMax
                            recipient: uniswapPool.address,
                        }, {
                            eip: 20,
                            adr: tokenB,
                            id: 0,
                            offset: 64,             // second item of _addLiquidity results
                            amount: amountBDesired, // amountInMax
                            recipient: uniswapPool.address,
                        }],
                    }, 
                    {
                        output: 1,
                        code: uniswapPool.address,
                        data: (await uniswapPool.populateTransaction.mint(to)).data,
                        tokens: [{
                            offset: 0,  // balance change verification
                            eip: 20,
                            adr: uniswapPool.address,
                            id: 0,
                            amount: 1,  // amountOutMin: just enough to verify the correct recipient
                            recipient: to,
                        }],
                    }
                ]);
            });
            it("Deposit WETH and transfer them out", async function () {
                const { universalRouter, weth, otherAccount } = await loadFixture(scenario.fixture);
                const someRecipient = otherAccount.address;
                // sample code to deposit WETH and transfer them out
                await universalRouter.exec([
                    {
                        output: 0,
                        code: AddressZero,
                        data: '0x',
                        tokens: [{
                            eip: 0,                 // ETH
                            adr: AddressZero,
                            id: 0,
                            offset: 0,              // use the exact amount specified bellow
                            amount: 123,
                            recipient: AddressZero, // pass it as the value for the next output action
                        }],
                    },
                    {
                        output: 1,
                        code: weth.address,
                        data: (await weth.populateTransaction.deposit()).data,    // WETH.deposit returns WETH token to the UTR contract
                        tokens: [{
                            offset: 1,  // token transfer sub-action
                            eip: 20,
                            adr: weth.address,
                            id: 0,
                            amount: 0,  // entire WETH balance of this UTR contract
                            recipient: someRecipient,
                        }],
                    },
                    // ... continue to use WETH in SomeRecipient
                ], {value: 123});
                expect(await weth.balanceOf(someRecipient)).to.equal(123);
            });
            it("Adapter contract for WETH", async function () {
                const { universalRouter, weth, wethAdapter, otherAccount } = await loadFixture(scenario.fixture);
                await weth.approve(universalRouter.address, MaxUint256);
                await weth.approve(wethAdapter.address, MaxUint256);
                const someRecipient = otherAccount.address;
                await universalRouter.exec([
                    {
                        output: 0,
                        code: AddressZero,
                        data: '0x',
                        tokens: [{
                            eip: 0,                 // ETH
                            adr: AddressZero,
                            id: 0,
                            offset: 0,              // use the exact amount specified bellow
                            amount: 123,
                            recipient: AddressZero, // pass it as the value for the next output action
                        }],
                    },
                    {
                        output: 1,
                        code: wethAdapter.address,
                        data: (await wethAdapter.populateTransaction.deposit(someRecipient)).data,    // WETH.deposit returns WETH token to the UTR contract
                        tokens: [
                            {
                                offset: 0,  // token balance verification
                                eip: 20,
                                adr: weth.address,
                                id: 0,
                                amount: 123,
                                recipient: someRecipient,
                            }
                        ],
                    },
                    // ... continue to use WETH in SomeRecipient
                ], {value: 123});
            });
        });
    });
});