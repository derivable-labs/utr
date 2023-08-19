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
    describe("Uniswap/v3: " + scenario.fixtureName, function () {
        let usdc, weth, utr, uniswapV3Helper, poolAddress, owner, uniswapv3PositionManager;
        beforeEach("load fixture", async () => {
            ({ usdc, weth, utr, uniswapV3Helper, poolAddress, owner, uniswapv3PositionManager } = await loadFixture(scenario.fixture));
        })
        function exactInputParams(tokenIn, tokenOut, amountIn, amountOutMin, payer = owner) {
            return {
                payer: payer.address,
                path: encodePath([tokenIn.address, tokenOut.address], [500]),
                recipient: owner.address,
                deadline: new Date().getTime() + 100000,
                amountIn,
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
                    amountIn: '2000',
                    recipient: poolAddress,
                }],
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
                    amountIn: '2000',
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
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
                path: encodePath([usdc.address, weth.address], [500]),
                recipient: AddressZero,
                deadline: new Date().getTime() + 100000,
                amountIn: '160000',
                amountOutMinimum: '100',
            }

            const data = [uniswapV3Helper.interface.encodeFunctionData('exactInput', [params])]
            data.push(uniswapV3Helper.interface.encodeFunctionData('unwrapWETH9', ['100', owner.address]))
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
                    amountIn: '160000',
                    recipient: poolAddress, // pass it as the value for the next output action
                }],
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
                    amountIn: '1000',
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
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
                amountOutMin: '3000000',
                recipient: owner.address,
            }], [{
                inputs: [{
                    mode: CALL_VALUE,
                    eip: 0, // ETH
                    token: AddressZero,
                    id: 0,
                    amountIn: '2000',
                    recipient: AddressZero, // pass it as the value for the next output action
                }],
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
                    amountIn: '1000',
                    recipient: poolAddress,
                }],
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactInputSingle({
                    payer: owner.address,
                    tokenIn: weth.address,
                    tokenOut: usdc.address,
                    fee: 500,
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
                    amountIn: '1600',
                    recipient: poolAddress,
                }],
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactOutput({
                    payer: owner.address,
                    path: encodePath([usdc.address, weth.address], [500]),
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
                    amountIn: '1600',
                    recipient: poolAddress,
                }],
                code: uniswapV3Helper.address,
                data: (await uniswapV3Helper.populateTransaction.exactOutputSingle({
                    payer: owner.address,
                    tokenIn: weth.address,
                    tokenOut: usdc.address,
                    fee: 500,
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