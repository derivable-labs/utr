// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Output {
    address recipient;
    uint eip;       // token standard: 0 for ETH or EIP number
    address token;  // token contract address
    uint id;        // token id for EIP721 and EIP1155
    uint amountOutMin;
}

struct Transfer {
    uint mode;
    address recipient;
    uint eip;       // token standard: 0 for ETH or EIP number
    address token;  // token contract address
    uint id;        // token id for EIP721 and EIP1155
    uint amountInMax;
    uint amountSource;
                    // with input actions: byte offset to get the amountIn from the lastInputResult bytes
                    // with output actions: 0 for token balance change verification, or output token transfer
}

struct Action {
    Transfer[] transfers;   // tokens to transfer or verify balance
    uint flags;
    address code;           // contract code address
    bytes data;             // contract input data
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
}

interface IUTRCallback {
    // 0x3696d736
    function utrCallback(
        address caller,
        bytes memory data
    ) external payable;
}