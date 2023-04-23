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

const PAYMENT       = 0;
const TRANSFER      = 1;
const CALL_VALUE    = 2;

const EIP_ETH = 0;
const ERC_721_BALANCE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UniversalTokenRouter.ERC_721_BALANCE"))

scenarios.forEach(function (scenario) {
    describe("Generic: " + scenario.fixtureName, function () {
        it("Contract revert", async function () {
            const { utr, wethAdapter } = await loadFixture(scenario.fixture);
            await expect(utr.exec([], [{
                flags: 0,
                inputs: [],
                code: wethAdapter.address,
                data: (await wethAdapter.populateTransaction.doRevert('some reason')).data,
            }])).revertedWith('some reason');
        });
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
                    mode: TRANSFER,
                    recipient: uniswapPool.address,
                    eip: 20,
                    token: path[0],
                    id: 0,
                    amountIn,
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
                    mode: CALL_VALUE,
                    eip: 0,                 // ETH
                    token: AddressZero,
                    id: 0,
                    amountIn: 123,
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
                id: ERC_721_BALANCE,
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