// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

struct Output {
    address recipient;
    uint256 eip;           // token standard: 0 for ETH or EIP number
    address token;      // token contract address
    uint256 id;            // token id for EIP721 and EIP1155
    uint256 amountOutMin;
}

struct Input {
    uint256 mode;
    address recipient;
    uint256 eip;           // token standard: 0 for ETH or EIP number
    address token;      // token contract address
    uint256 id;            // token id for EIP721 and EIP1155
    uint256 amountInMax;
    uint256 amountSource;  // where to get the actual amountIn
}

struct Action {
    Input[] inputs;
    uint256 flags;
    address code;       // contract code address
    bytes data;         // contract input data
}

interface IUniversalTokenRouter {
    function exec(
        Output[] memory outputs,
        Action[] memory actions
    ) external payable;

    function pay(
        address sender,
        address recipient,
        uint256 eip,
        address token,
        uint256 id,
        uint256 amount
    ) external;
}
