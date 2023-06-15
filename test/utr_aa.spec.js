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
const ERC_721_BALANCE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UTRAllowanceAdapter.ERC_721_BALANCE"))

scenarios.forEach(function (scenario) {
    describe("UTR Allowance Adapter: " + scenario.fixtureName, function () {
        describe("ERC-20", function () {
            it("swapExactTokensForTokens uniswap v2", async function () {
                const { utr, utraa, uniswapRouter, weth, busd, owner } = await loadFixture(scenario.fixture)
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
                        recipient: utraa.address,
                        eip: 20,
                        token: path[0],
                        id: 0,
                        amountIn,
                    }],
                    code: utraa.address,
                    data: (await utraa.populateTransaction.approveAndCall(
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
                expect(await weth.balanceOf(utraa.address)).equal(0)
                expect(await busd.balanceOf(utraa.address)).equal(0)
            })
        
            it("deposit WETH", async function () {
                const { utr, utraa, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
                const someRecipient = otherAccount.address
                await utr.exec([], [{
                    inputs: [{
                        mode: CALL_VALUE,
                        eip: 0,                 // ETH
                        token: AddressZero,
                        id: 0,
                        amountIn: 123,
                        recipient: utraa.address,
                    }],
                    flags: 0,
                    code: utraa.address,
                    data: (await utraa.populateTransaction.approveAndCall(
                        [
                            {
                                eip: 0,
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
                expect(await weth.balanceOf(utraa.address)).equal(0)
            })
            it("withdraw WETH", async function () {
                const { utr, utraa, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
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
                        recipient: utraa.address,
                    }],
                    flags: 0,
                    code: utraa.address,
                    data: (await utraa.populateTransaction.approveAndCall(
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
                                eip: 0,
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
                const { utr, utraa, uniswapRouter, uniswapPool, busd, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
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
                        recipient: utraa.address,
                    }, {
                        mode: TRANSFER,
                        eip: 20,
                        token: tokenB,
                        id: 0,
                        amountIn: amountBDesired,
                        recipient: utraa.address,
                    }],
                    flags: 0,
                    code: utraa.address,
                    data: (await utraa.populateTransaction.approveAndCall(
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
                            utraa.address,
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
                const { utr, utraa, uniswapRouter, uniswapPool, busd, weth, owner, otherAccount } = await loadFixture(scenario.fixture)
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
                        recipient: utraa.address,
                    }],
                    flags: 0,
                    code: utraa.address,
                    data: (await utraa.populateTransaction.approveAndCall(
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
                            utraa.address,
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
                expect(await uniswapPool.balanceOf(utraa.address)).eq(0)
                expect(await weth.balanceOf(utraa.address)).eq(0)
                expect(await busd.balanceOf(utraa.address)).eq(0)
                expect(wethChanged).gt(0)
                expect(busdChanged).gt(0)
            })
        })
    })
})