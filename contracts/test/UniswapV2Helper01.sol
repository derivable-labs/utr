// SPDX-License-Identifier: MIT
pragma solidity =0.6.6;
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

interface IUniversalTokenRouter {
    function pay(bytes calldata payment, uint256 amount) external;
}


contract UniswapV2Helper01 {
    address public immutable factory;
    address public immutable WETH;
    address public immutable UTR;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "UniswapV2Helper01: EXPIRED");
        _;
    }

    constructor(address _factory, address _WETH, address _UTR) public {
        factory = _factory;
        WETH = _WETH;
        UTR = _UTR;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual ensure(deadline) returns (uint256[] memory amounts) {
        amounts = UniswapV2Library.getAmountsOut(factory, amountIn, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        /* This function does what UniswapV2Router01.swapExactTokensForTokens does, without the token transfer part */
        // TransferHelper.safeTransferFrom(
        //     path[0], msg.sender, UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        // );
        _swap(amounts, path, to);
    }
    
    function swapTokensForTokensExact(
        uint256 amountInMax,
        uint256 amountOut,
        address[] calldata path,
        address payer,
        address to,
        uint256 deadline
    ) external virtual ensure(deadline) returns (uint256[] memory amounts) {
        amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);
        require(
            amounts[0] <= amountInMax,
            "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        /* This function does what UniswapV2Router01.swapExactTokensForTokens does, without the token transfer part */
        // TransferHelper.safeTransferFrom(
        //     path[0], msg.sender, UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        // );
        pay(payer, path[0], UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    /* This function accepts the uint256[] amounts as the last bytes param,
    decode and pass to the internal function _swap of UniswapV2Helper01 */
    function swap(
        address[] calldata path,
        address _to,
        bytes calldata amountsBytes
    ) external {
        uint256[] memory amounts = abi.decode(amountsBytes, (uint256[]));
        _swap(amounts, path, _to);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address payer,
        address receipent
    ) external virtual returns (uint256 amountA, uint256 amountB) {
        // create the pair if it doesn't exist yet
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = IUniswapV2Factory(factory).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(
            factory,
            tokenA,
            tokenB
        );
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = UniswapV2Library.quote(
                amountADesired,
                reserveA,
                reserveB
            );
            if (amountBOptimal <= amountBDesired) {
                require(
                    amountBOptimal >= amountBMin,
                    "UniswapV2Router: INSUFFICIENT_B_AMOUNT"
                );
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = UniswapV2Library.quote(
                    amountBDesired,
                    reserveB,
                    reserveA
                );
                assert(amountAOptimal <= amountADesired);
                require(
                    amountAOptimal >= amountAMin,
                    "UniswapV2Router: INSUFFICIENT_A_AMOUNT"
                );
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
        pay(payer, tokenA, pair, amountA);
        pay(payer, tokenB, pair, amountB);
        IUniswapV2Pair(pair).mint(receipent);
    }

    function pay(address payer, address token, address receipent, uint256 amount) internal {
        bytes memory payment = abi.encode(payer, receipent, 20, token, 0);
        IUniversalTokenRouter(UTR).pay(payment, amount);
    }

    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal virtual {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = UniswapV2Library.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? UniswapV2Library.pairFor(factory, output, path[i + 2])
                : _to;
            IUniswapV2Pair(UniswapV2Library.pairFor(factory, input, output))
                .swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function getAmountsIn(uint256 amountOut, address[] memory path)
        public
        view
        virtual
        returns (uint256[] memory amounts)
    {
        return UniswapV2Library.getAmountsIn(factory, amountOut, path);
    }
}
