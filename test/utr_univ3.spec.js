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

const FROM_ROUTER   = 10;
const PAYMENT       = 0;
const TRANSFER      = 1;
const ALLOWANCE     = 2;
const CALL_VALUE    = 3;

const AMOUNT_EXACT = 0;
const AMOUNT_ALL = 1;
const EIP_ETH = 0;
const ID_721_ALL = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UniversalTokenRouter.ID_721_ALL"))
const ACTION_IGNORE_ERROR = 1;
const ACTION_RECORD_CALL_RESULT = 2;
const ACTION_INJECT_CALL_RESULT = 4;

scenarios.forEach(function (scenario) {
    describe("Uniswap/v3: " + scenario.fixtureName, function () {
        let usdc, weth, utr, uniswapV3Helper, poolAddress, owner, uniswapv3PositionManager;
        beforeEach("load fixture", async () => {
            ({ usdc, weth, utr, uniswapV3Helper, poolAddress, owner, uniswapv3PositionManager } = await loadFixture(scenario.fixture));
        })
        function exactInputParams(tokenIn, tokenOut, amountIn, amountOutMin, payer = owner) {
            return {
                payer: payer.address,
                path: encodePath([tokenIn.address, tokenOut.address], [3000]),
                recipient: owner.address,
                deadline: new Date().getTime() + 100000,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
            }
        }
        it("weth -> usdc", async function () {
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(1) });

            await utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 1,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: PAYMENT,
                    eip: 20,
                    token: weth.address,
                    id: 0,
                    amountSource: AMOUNT_EXACT,
                    amountInMax: '2000',
                    recipient: poolAddress,
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactInput(
                    exactInputParams(weth, usdc, '2000', 0)
                )).data,
            }])

            await expect(utr.pay(
                owner.address,
                poolAddress,
                20,
                weth.address,
                0,
                1,
            )).revertedWith('INSUFFICIENT_PAYMENT')
        });

        it("eth -> usdc", async function () {
            await utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 1,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: '2000',
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactInput(
                    exactInputParams(weth, usdc, '2000', 0)
                )).data,
            }], {
                value: 2345,
            })

            expect(await ethers.provider.getBalance(utr.address)).equal(0)
        });

        it("usdc -> eth multicall", async function () {
            await usdc.approve(utr.address, MaxUint256);
            const params = {
                payer: owner.address,
                path: encodePath([usdc.address, weth.address], [3000]),
                recipient: AddressZero,
                deadline: new Date().getTime() + 100000,
                amountIn: '1600',
                amountOutMinimum: '1',
            }

            const data = [uniswapV3Helper.interface.encodeFunctionData('exactInput', [params])]
            data.push(uniswapV3Helper.interface.encodeFunctionData('unwrapWETH9', ['1000', owner.address]))
            await utr.exec([{
                eip: 0,
                token: AddressZero,
                id: 0,
                amountOutMin: 0,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: PAYMENT,
                    eip: 20,
                    token: usdc.address,
                    id: 0,
                    amountInMax: '2000',
                    amountSource: AMOUNT_EXACT,
                    recipient: poolAddress, // pass it as the value for the next output action
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.multicall(
                    data
                )).data,
            }])
        });

        it("insufficient input", async function () {
            const request = utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 1,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: '1000',
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactInput(
                    exactInputParams(weth, usdc, '2000', 0)
                )).data,
            }], {
                value: '2000'
            })
            await expect(request).to.be.revertedWith('UniversalTokenRouter: INSUFFICIENT_PAYMENT')
        });

        it("insufficient output", async function () {
            const request = utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 2100,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: '2000',
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactInput(
                    exactInputParams(weth, usdc, '2000', 0)
                )).data,
            }], {
                value: '2000'
            })
            await expect(request).to.be.revertedWith('UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT')
        })


        it("UniswapV3Router.exactInputSingle", async function () {
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(1) });

            await utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 0,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: PAYMENT,
                    eip: 20,
                    token: weth.address,
                    id: 0,
                    amountSource: AMOUNT_EXACT,
                    amountInMax: '1000',
                    recipient: poolAddress,
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactInputSingle({
                    payer: owner.address,
                    tokenIn: weth.address,
                    tokenOut: usdc.address,
                    fee: 3000,
                    sqrtPriceLimitX96: weth.address.toLowerCase() < usdc.address.toLowerCase()
                        ? bn('4295128740')
                        : bn('1461446703485210103287273052203988822378723970341'),
                    recipient: owner.address,
                    deadline: new Date().getTime() + 100000,
                    amountIn: '1000',
                    amountOutMinimum: 0,
                })).data,
            }])
        });

        it("UniswapV3Router.exactOutput", async function () {
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(1) });

            await utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 1,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: PAYMENT,
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

        it("UniswapV3Router.exactOutputSingle", async function () {
            await weth.approve(utr.address, MaxUint256);
            await weth.deposit({ value: pe(1) });

            await utr.exec([{
                eip: 20,
                token: usdc.address,
                id: 0,
                amountOutMin: 1,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: PAYMENT,
                    eip: 20,
                    token: weth.address,
                    id: 0,
                    amountSource: AMOUNT_EXACT,
                    amountInMax: '1600',
                    recipient: poolAddress,
                }],
                flags: 0,
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactOutputSingle({
                    payer: owner.address,
                    tokenIn: weth.address,
                    tokenOut: usdc.address,
                    fee: 3000,
                    sqrtPriceLimitX96: weth.address.toLowerCase() < usdc.address.toLowerCase()
                        ? bn('4295128740')
                        : bn('1461446703485210103287273052203988822378723970341'),
                    recipient: owner.address,
                    deadline: new Date().getTime() + 100000,
                    amountOut: '1',
                    amountInMaximum: '1600',
                })).data,
            }])
        });

        it("PositionManager.mint: ALLOWANCE", async function () {
            await usdc.approve(utr.address, MaxUint256);

            // Mint
            await utr.exec([{
                eip: 721,
                token: uniswapv3PositionManager.address,
                id: 2,
                amountOutMin: 1,
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: ALLOWANCE,
                    eip: 20,
                    token: usdc.address,
                    id: 0,
                    amountSource: AMOUNT_EXACT,
                    amountInMax: '2000',
                    recipient: uniswapv3PositionManager.address,
                }, {
                    mode: CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: '2000',
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: uniswapv3PositionManager.address,
                data: (await uniswapv3PositionManager.populateTransaction.mint({
                    token0: usdc.address,
                    token1: weth.address,
                    fee: 3000,
                    tickLower: Math.ceil(-800000 / 60) * 60,
                    tickUpper: Math.floor(800000 / 60) * 60,
                    amount0Desired: '2000',
                    amount1Desired: '2000',
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: owner.address,
                    deadline: new Date().getTime() + 100000
                })).data,
            }], {
                value: '2000'
            })

            //Add liquidity
            await utr.exec([], [{
                inputs: [{
                    mode: ALLOWANCE,
                    eip: 20,
                    token: usdc.address,
                    id: 0,
                    amountSource: AMOUNT_EXACT,
                    amountInMax: '2000',
                    recipient: uniswapv3PositionManager.address,
                }, {
                    mode: CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountInMax: '2000',
                    amountSource: AMOUNT_EXACT,
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
                flags: 0,
                code: uniswapv3PositionManager.address,
                data: (await uniswapv3PositionManager.populateTransaction.increaseLiquidity({
                    tokenId: 2,
                    amount0Desired: '2000',
                    amount1Desired: '2000',
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: owner.address,
                    deadline: new Date().getTime() + 100000
                })).data,
            }], {
                value: '2000'
            })

            expect(await usdc.balanceOf(utr.address)).equal(0)
            expect(await usdc.allowance(utr.address, uniswapv3PositionManager.address)).equal(0)

            const { liquidity } = await uniswapv3PositionManager.positions(2)

            // Decrease Liquidity
            await uniswapv3PositionManager.decreaseLiquidity({
                tokenId: 2,
                liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: new Date().getTime() + 100000
            })

            // Sweep tokens
            await uniswapv3PositionManager.collect({
                tokenId: 2,
                recipient: owner.address,
                amount0Max: '1000000000000000',
                amount1Max: '1000000000000000',
            })

            // Burn NFT
            await uniswapv3PositionManager.burn(2)
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