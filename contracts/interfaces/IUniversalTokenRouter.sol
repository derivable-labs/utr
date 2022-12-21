// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Action {
    bool output;    // true for output action, false for input action
    uint eip;       // token type: 0 for ETH, # for ERC#
    address token;  // token contract address
    uint id;        // token id for EIP721 and EIP1155
    uint amount;    // amountInMax for input action, amountOutMin for output action
    address recipient;
    address code;   // contract code address
    bytes data;     // contract data
}

interface IUniversalTokenRouter {
    function exec(
        Action[] calldata actions
    ) external payable returns (
        uint[] memory results,
        uint gasLeft
    );
}