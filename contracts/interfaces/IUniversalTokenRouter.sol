// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Token {
    uint mode;
    uint eip;       // token standard: 0 for ETH or EIP number
    uint offset;    // with input actions: byte offset to get the amountIn from the lastInputResult bytes
                    // with output actions: 0 for token balance change verification, or output token transfer
    address adr;    // token contract address
    uint id;        // token id for EIP721 and EIP1155
    uint amount;    // amountInMax for input action, amountOutMin for output action
    address recipient;
}

struct Action {
    uint flags;
    address code;   // contract code address
    bytes data;     // contract input data
    uint value;     // contract call ETH value
    Token[] tokens; // tokens to transfer or verify balance
}

interface IUniversalTokenRouter {
    function exec(Action[] calldata actions) external payable;
}