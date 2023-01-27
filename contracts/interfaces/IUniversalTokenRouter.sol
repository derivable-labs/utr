// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Output {
    address recipient;
    uint eip;           // token standard: 0 for ETH or EIP number
    address token;      // token contract address
    uint id;            // token id for EIP721 and EIP1155
    uint amountOutMin;
}

struct Input {
    uint mode;
    address recipient;
    uint eip;           // token standard: 0 for ETH or EIP number
    address token;      // token contract address
    uint id;            // token id for EIP721 and EIP1155
    uint amountInMax;
    uint amountSource;  // where to get the actual amountIn
}

struct Action {
    Input[] inputs;
    uint flags;
    address code;       // contract code address
    bytes data;         // contract input data
}

struct Transfer {
    address sender;
    address recipient;
    uint eip;
    address token;
    uint id;
    uint amount;
}

interface IUniversalTokenRouter {
    function exec(
        Output[] memory outputs,
        Action[] memory actions
    ) external payable;

    function transferToken(
        address sender,
        address recipient,
        uint eip,
        address token,
        uint id,
        uint amount
    ) external;

    function transferTokens(
        Transfer[] calldata transfers
    ) external;
}

interface IUTRCallback {
    // 0x3696d736
    function utrCallback(
        address caller,
        bytes memory data
    ) external payable;
}