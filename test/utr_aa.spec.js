const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers")
const { makeInterfaceId } = require('@openzeppelin/test-helpers')
const chai = require("chai")
const { solidity } = require("ethereum-waffle")
chai.use(solidity)
const expect = chai.expect
const { ethers } = require("hardhat")
const { bn } = require("./shared/utilities")
const { AddressZero, MaxUint256 } = ethers.constants
const { scenario01 } = require("./shared/fixtures")

const fe = (x) => Number(ethers.utils.formatEther(x))
const pe = (x) => ethers.utils.parseEther(String(x))

const scenarios = [
    { fixture: scenario01, fixtureName: "(ETH = 1500 BUSD)" },
]

const PAYMENT       = 0
const TRANSFER      = 1
const CALL_VALUE    = 2

const EIP_ETH = 0

scenarios.forEach(function (scenario) {
    describe("UTR Allowance Adapter: " + scenario.fixtureName, function () {
        describe("ERC-20", function () {
            it("swapExactTokensForTokens uniswap v2", async function () {
                const { utr, adapter, uniswapRouter, weth, busd, owner } = await loadFixture(scenario.fixture)
                await weth.approve(utr.address, MaxUint256)
                await weth.deposit({ value: pe(100) })
                const amountIn = 100
                const amountOutMin = 140000
                const path = [
                    weth.address,
                    busd.address
                ]
                const to = owner.address
                const deadline = MaxUint256
    
                const wethBefore = await weth.balanceOf(to)
                const busdBefore = await busd.balanceOf(to)
                await utr.exec([], [{
                    flags: 0,
                    inputs: [{
                        mode: TRANSFER,
                        recipient: adapter.address,
                        eip: 20,
                        token: path[0],
                        id: 0,
                        amountIn,
                    }],
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 20,
                                token: path[0],
                                id: 0,
                                amountIn,
                            }
                        ],
                        uniswapRouter.address,
                        (await uniswapRouter.populateTransaction.swapExactTokensForTokens(
                            amountIn,
                            amountOutMin,
                            path,
                            to,
                            deadline
                        )).data,
                        [],
                        to
                    )).data,
                }])
                const wethAfter = await weth.balanceOf(to)
                const busdAfter = await busd.balanceOf(to)
                const wethChanged = wethBefore.sub(wethAfter)
                const busdChanged = busdAfter.sub(busdBefore)
                expect(wethChanged).equal(amountIn)
                expect(busdChanged).equal(149550)
                expect(await weth.balanceOf(adapter.address)).equal(0)
                expect(await busd.balanceOf(adapter.address)).equal(0)
            })
        
            it("deposit WETH", async function () {
                const { utr, adapter, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
                const someRecipient = otherAccount.address
                await utr.exec([], [{
                    inputs: [{
                        mode: CALL_VALUE,
                        eip: EIP_ETH,                 // ETH
                        token: AddressZero,
                        id: 0,
                        amountIn: 123,
                        recipient: adapter.address,
                    }],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: EIP_ETH,
                                token: AddressZero,
                                id: 0,
                                amountIn: 123,
                            }
                        ],
                        weth.address,
                        (await weth.populateTransaction.deposit()).data,
                        [
                            {
                                eip: 20,
                                token: weth.address,
                                id: 0,
                            }
                        ],
                        someRecipient
                    )).data,
                }], { value: 123 })
                expect(await weth.balanceOf(someRecipient)).equal(123)
                expect(await weth.balanceOf(adapter.address)).equal(0)
            })
            it("withdraw WETH", async function () {
                const { utr, adapter, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
                await weth.connect(otherAccount).deposit({ value: 100 })
                await weth.connect(otherAccount).approve(utr.address, MaxUint256)
                const ethBefore = await owner.getBalance()
                await utr.connect(otherAccount).exec([], [{
                    inputs: [{
                        mode: TRANSFER,
                        eip: 20,
                        token: weth.address,
                        id: 0,
                        amountIn: 100,
                        recipient: adapter.address,
                    }],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 20,
                                token: weth.address,
                                id: 0,
                                amountIn: 100,
                            }
                        ],
                        weth.address,
                        (await weth.populateTransaction.withdraw(100)).data,
                        [
                            {
                                eip: EIP_ETH,
                                token: AddressZero,
                                id: 0,
                            }
                        ],
                        owner.address
                    )).data,
                }])
                const ethAfter = await owner.getBalance()
                const ethChanged = ethAfter.sub(ethBefore)
                expect(ethChanged).equal(100)
            })
    
            it("add liquidity uniswap v2", async function () {
                const { utr, adapter, uniswapRouter, uniswapPool, busd, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
                await weth.approve(utr.address, MaxUint256)
                await weth.deposit({ value: pe(100) })
                await busd.approve(utr.address, MaxUint256)
    
                const tokenA = busd.address
                const tokenB = weth.address
                const amountADesired = pe(1500)
                const amountBDesired = pe(1)
                const to = otherAccount.address
                const deadline = MaxUint256
    
                const lpBefore = await uniswapPool.balanceOf(to)
    
                await utr.exec([], [{
                    inputs: [{
                        mode: TRANSFER,
                        eip: 20,
                        token: tokenA,
                        id: 0,
                        amountIn: amountADesired,
                        recipient: adapter.address,
                    }, {
                        mode: TRANSFER,
                        eip: 20,
                        token: tokenB,
                        id: 0,
                        amountIn: amountBDesired,
                        recipient: adapter.address,
                    }],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 20,
                                token: tokenA,
                                id: 0,
                                amountIn: amountADesired,
                            },
                            {
                                eip: 20,
                                token: tokenB,
                                id: 0,
                                amountIn: amountBDesired,
                            }
                        ],
                        uniswapRouter.address,
                        (await uniswapRouter.populateTransaction.addLiquidity(
                            tokenA,
                            tokenB,
                            amountADesired,
                            amountBDesired,
                            0,
                            0,
                            adapter.address,
                            deadline
                        )).data,
                        [
                            {
                                eip: 20,
                                token: uniswapPool.address,
                                id: 0,
                            }
                        ],
                        to
                    )).data,
                }])
    
                const lpAfter = await uniswapPool.balanceOf(to)
                const lpChanged = lpAfter.sub(lpBefore)
                expect(lpChanged).equal("38729833462032071965")
            })
    
            it("remove liquidity uniswap v2", async function () {
                const { utr, adapter, uniswapRouter, uniswapPool, busd, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
                await uniswapPool.approve(utr.address, MaxUint256)
                
                const tokenA = busd.address
                const tokenB = weth.address
                const to = otherAccount.address
                const deadline = MaxUint256
    
                const wethBefore = await weth.balanceOf(to)
                const busdBefore = await busd.balanceOf(to)
                await utr.exec([], [{
                    inputs: [{
                        mode: TRANSFER,
                        eip: 20,
                        token: uniswapPool.address,
                        id: 0,
                        amountIn: pe(1),
                        recipient: adapter.address,
                    }],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 20,
                                token: uniswapPool.address,
                                id: 0,
                                amountIn: pe(1),
                            }
                        ],
                        uniswapRouter.address,
                        (await uniswapRouter.populateTransaction.removeLiquidity(
                            tokenA,
                            tokenB,
                            pe(1),
                            0,
                            0,
                            adapter.address,
                            deadline
                        )).data,
                        [
                            {
                                eip: 20,
                                token: tokenA,
                                id: 0,
                            },
                            {
                                eip: 20,
                                token: tokenB,
                                id: 0,
                            }
                        ],
                        to
                    )).data,
                }])
                const wethAfter = await weth.balanceOf(to)
                const busdAfter = await busd.balanceOf(to)
                const wethChanged = wethAfter.sub(wethBefore)
                const busdChanged = busdAfter.sub(busdBefore)
                expect(await uniswapPool.balanceOf(adapter.address)).eq(0)
                expect(await weth.balanceOf(adapter.address)).eq(0)
                expect(await busd.balanceOf(adapter.address)).eq(0)
                expect(wethChanged).gt(0)
                expect(busdChanged).gt(0)
            })
        })
    
        describe("ERC-721", function () {
            it("input/output token", async function () {
                const { utr, adapter, gameItem, owner } = await loadFixture(scenario.fixture)
                await gameItem.setApprovalForAll(utr.address, true)
                const tokenURI = "https://game.example/item.json"
                const player = owner.address
                // mint
                await utr.exec([], [{
                    inputs: [],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [],
                        gameItem.address,
                        (await gameItem.populateTransaction.awardItem(player, tokenURI)).data,
                        [
                            {
                                eip: 721,
                                token: gameItem.address,
                                id: 0,
                            }
                        ],
                        player
                    )).data,
                }])
                expect(await gameItem.ownerOf(0)).equal(player)
                // burn --> mint
                await utr.exec([], [{
                    inputs: [{
                        mode: TRANSFER,
                        eip: 721,
                        token: gameItem.address,
                        id: 0,
                        amountIn: 0,
                        recipient: adapter.address,
                    }],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 721,
                                token: gameItem.address,
                                id: 0,
                                amountIn: 1,
                            }
                        ],
                        gameItem.address,
                        (await gameItem.populateTransaction.upgradeItem(player,0,tokenURI)).data,
                        [
                            {
                                eip: 721,
                                token: gameItem.address,
                                id: 1,
                            }
                        ],
                        player
                    )).data,
                }])
                expect(await gameItem.balanceOf(adapter.address)).equal(0)
                expect(await gameItem.ownerOf(1)).equal(player)
            })
        })

        describe("ERC-1155", function () {
            it("input/output token", async function () {
                const { utr, adapter, gameItems, owner } = await loadFixture(scenario.fixture)
                await gameItems.setApprovalForAll(utr.address, true)
                const player = owner.address
                // burn --> mint
                await utr.exec([], [{
                    inputs: [{
                        mode: TRANSFER,
                        eip: 1155,
                        token: gameItems.address,
                        id: 0,
                        amountIn: 10,
                        recipient: adapter.address,
                    }],
                    flags: 0,
                    code: adapter.address,
                    data: (await adapter.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 1155,
                                token: gameItems.address,
                                id: 0,
                                amountIn: 10,
                            }
                        ],
                        gameItems.address,
                        (await gameItems.populateTransaction.swapItems(player,0,10,5)).data,
                        [
                            {
                                eip: 1155,
                                token: gameItems.address,
                                id: 5,
                            }
                        ],
                        player
                    )).data,
                }])
                expect(await gameItems.balanceOf(adapter.address, 0)).equal(0)
                expect(await gameItems.balanceOf(adapter.address, 5)).equal(0)
                expect(await gameItems.balanceOf(player, 5)).equal(10)
            })
        })
    })
})