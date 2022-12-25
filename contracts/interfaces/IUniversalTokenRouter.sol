// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Token {
    uint eip;       // token type: 0 for ETH, # for ERC#
    address adr;  // token contract address
    uint id;        // token id for EIP721 and EIP1155
    uint amount;    // amountInMax for input action, amountOutMin for output action
    address recipient;
}

struct Action {
    int inputOffset;  // 0 for output action, != 0 for input return data offset
    address code;               // contract code address
    bytes data;                 // contract input data
    Token[] tokens;
}

interface IUniversalTokenRouter {
    function exec(
        Action[] calldata actions
    ) external payable returns (
        uint[][] memory results,
        uint gasLeft
    );
}