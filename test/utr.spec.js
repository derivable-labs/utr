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

const TRANSFER_FROM_SENDER = 0;
const TRANSFER_FROM_ROUTER = 1;
const TRANSFER_CALL_VALUE = 2;
const IN_TX_PAYMENT = 4;
const ALLOWANCE_BRIDGE = 8;
const AMOUNT_EXACT = 0;
const AMOUNT_ALL = 1;
const EIP_ETH = 0;
const ID_721_ALL = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UniversalTokenRouter.ID_721_ALL"))
const ACTION_IGNORE_ERROR = 1;
const ACTION_RECORD_CALL_RESULT = 2;
const ACTION_INJECT_CALL_RESULT = 4;

scenarios.forEach(function (scenario) {
    describe("Generic: " + scenario.fixtureName, function () {
        it("UniswapRouter.swapExactTokensForTokens", async function () {
            const { utr, uniswapPool, busd, weth, uniswapV2Helper01, owner } = await loadFixture(scenario.fixture);
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(100) });

            const amountIn = pe(1);
            const amountOutMin = pe(1400);
            const path = [
                weth.address,
                busd.address
            ];
            const to = owner.address
            const deadline = MaxUint256

            await utr.exec([{
                recipient: to,
                eip: 20,
                token: path[path.length - 1],
                id: 0,
                amountOutMin,
            }], [{
                flags: 0,
                inputs: [{
                    mode: TRANSFER_FROM_SENDER,
                    recipient: uniswapPool.address,
                    eip: 20,
                    token: path[0],
                    id: 0,
                    amountInMax: amountIn,
                    amountSource: AMOUNT_EXACT,
                }],
                code: uniswapV2Helper01.address,
                data: (await uniswapV2Helper01.populateTransaction.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    to,
                    deadline
                )).data,
            }]);
        });
        it("UniswapRouter.swapTokensForExactTokens", async function () {
            const { utr, uniswapPool, busd, weth, uniswapV2Helper01, owner } = await loadFixture(scenario.fixture);
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(100) });

            const amountOut = pe(1400);
            const path = [
                weth.address,
                busd.address
            ];
            const amountInMax = pe(1);
            const to = owner.address;

            await utr.exec([{
                eip: 20,
                token: path[path.length - 1],
                id: 0,
                amountOutMin: amountOut,
                recipient: to,
            }], [{
                inputs: [],
                flags: ACTION_RECORD_CALL_RESULT,
                code: uniswapV2Helper01.address,
                data: (await uniswapV2Helper01.populateTransaction.getAmountsIn(amountOut, path)).data,
            }, {
                inputs: [{
                    mode: TRANSFER_FROM_SENDER,
                    eip: 20,
                    token: path[0],
                    id: 0,
                    amountInMax,
                    amountSource: 32 * 3, // first item of getAmountIns result array
                    recipient: uniswapPool.address,
                }],
                flags: ACTION_INJECT_CALL_RESULT,
                code: uniswapV2Helper01.address,
                data: (await uniswapV2Helper01.populateTransaction.swap(path, to, '0x')).data,
            }]);
        });
        it("UniswapRouter.addLiquidity", async function () {
            const { utr, uniswapPool, busd, weth, uniswapV2Helper01, owner } = await loadFixture(scenario.fixture);
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(100) });
            await busd.approve(utr.address, MaxUint256);

            const tokenA = busd.address;
            const tokenB = weth.address;
            const amountADesired = pe(1500);
            const amountBDesired = pe(1);
            const amountAMin = pe(0);
            const amountBMin = pe(0);
            const to = owner.address;

            await utr.exec([{
                eip: 20,
                token: uniswapPool.address,
                id: 0,
                amountOutMin: 1,  // just enough to verify the correct recipient
                recipient: to,
            }], [{
                inputs: [],
                flags: ACTION_RECORD_CALL_RESULT,
                code: uniswapV2Helper01.address,
                data: (await uniswapV2Helper01.populateTransaction._addLiquidity(
                    tokenA,
                    tokenB,
                    amountADesired,
                    amountBDesired,
                    amountAMin,
                    amountBMin,
                )).data,
            }, {
                inputs: [{
                    mode: TRANSFER_FROM_SENDER,
                    eip: 20,
                    token: tokenA,
                    id: 0,
                    amountSource: 32,             // first item of _addLiquidity results
                    amountInMax: amountADesired,
                    recipient: uniswapPool.address,
                }, {
                    mode: TRANSFER_FROM_SENDER,
                    eip: 20,
                    token: tokenB,
                    id: 0,
                    amountSource: 64,             // second item of _addLiquidity results
                    amountInMax: amountBDesired,
                    recipient: uniswapPool.address,
                }],
                flags: 0,
                code: uniswapPool.address,
                data: (await uniswapPool.populateTransaction.mint(to)).data,
            }]);
        });
        it("Deposit WETH and transfer them out", async function () {
            const { utr, weth, otherAccount } = await loadFixture(scenario.fixture);
            const someRecipient = otherAccount.address;
            // sample code to deposit WETH and transfer them out
            await utr.exec([{
                eip: 20,
                token: weth.address,
                id: 0,
                amountOutMin: 1,
                recipient: someRecipient,
            }], [{
                inputs: [{
                    mode: TRANSFER_CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: 123,
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: weth.address,
                data: (await weth.populateTransaction.deposit()).data,    // WETH.deposit returns WETH token to the UTR contract
            }, {
                inputs: [{
                    mode: TRANSFER_FROM_ROUTER,
                    eip: 20,
                    token: weth.address,
                    id: 0,
                    amountInMax: 123,
                    amountSource: AMOUNT_ALL,   // entire WETH balance of this UTR contract
                    recipient: someRecipient,
                }],
                // ... continue to use WETH in SomeRecipient
                flags: 0,
                code: AddressZero,
                data: '0x',
            }], { value: 123 });
            expect(await weth.balanceOf(someRecipient)).to.equal(123);
        });
        it("Adapter contract for WETH", async function () {
            const { utr, weth, wethAdapter, otherAccount } = await loadFixture(scenario.fixture);
            await weth.approve(utr.address, MaxUint256);
            await weth.approve(wethAdapter.address, MaxUint256);
            const someRecipient = otherAccount.address;
            await utr.exec([{
                eip: 20,
                token: weth.address,
                id: 0,
                amountOutMin: 1,
                recipient: someRecipient,
            }], [{
                inputs: [{
                    mode: TRANSFER_CALL_VALUE,
                    eip: 0,                 // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: 123,
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: wethAdapter.address,
                data: (await wethAdapter.populateTransaction.deposit(someRecipient)).data,    // WETH.deposit returns WETH token to the UTR contract
            },
                // ... continue to use WETH in SomeRecipient
            ], { value: 123 });
        });
        it("Output Token Verification - EIP-721", async function () {
            const { utr, gameItem, owner } = await loadFixture(scenario.fixture);
            await gameItem.setApprovalForAll(utr.address, true);
            const tokenURI = "https://game.example/item.json";
            const player = owner.address;
            const amount = 3;
            await utr.exec([{
                eip: 721,
                token: gameItem.address,
                id: 0,
                amountOutMin: 1,
                recipient: player,
            }], [{
                inputs: [],
                flags: 0,
                code: gameItem.address,
                data: (await gameItem.populateTransaction.awardItem(player, tokenURI)).data,
            }]);
            expect(await gameItem.ownerOf(0)).to.equal(player);
            await utr.exec([{
                eip: 721,
                token: gameItem.address,
                id: 1,
                amountOutMin: 1,
                recipient: player,
            }], [{
                inputs: [],
                flags: 1,
                code: gameItem.address,
                data: (await gameItem.populateTransaction.awardItem(player, tokenURI)).data,
            }]);
            expect(await gameItem.ownerOf(1)).to.equal(player);
            await expect(utr.exec([{
                eip: 721,
                token: gameItem.address,
                id: 2,
                amountOutMin: 2,
                recipient: player,
            }], [{
                inputs: [],
                flags: 0,
                code: gameItem.address,
                data: (await gameItem.populateTransaction.awardItem(player, tokenURI)).data,
            }])).to.revertedWith("UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT");
            await utr.exec([{
                eip: 721,
                token: gameItem.address,
                id: ID_721_ALL,
                amountOutMin: 3,
                recipient: player,
            }], [{
                inputs: [],
                flags: 0,
                code: gameItem.address,
                data: (await gameItem.populateTransaction.awardItems(amount, player, tokenURI)).data,
            }]);
        });
    });
});