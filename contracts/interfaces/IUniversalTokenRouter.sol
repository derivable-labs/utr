// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Token {
    uint eip;       // token standard: 0 for ETH or EIP number
    address adr;    // token contract address
    uint id;        // token id for EIP721 and EIP1155
    uint amount;    // amountInMax for input action, amountOutMin for output action
    uint offset;    // with input actions: byte offset to get the amountIn from the lastInputResult bytes
                    // with output actions: 0 for token balance change verification, or output token transfer
    address recipient;
}

struct Action {
    uint output;    // 0 for input, 1 for mandatory output, 2 for optional (failable) output
    address code;   // contract code address
    bytes data;     // contract input data
    Token[] tokens; // tokens to transfer or verify balance
}

interface IUniversalTokenRouter {
    function exec(Action[] calldata actions) external payable;
}