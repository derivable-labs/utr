// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IUniversalTokenRouter.sol";

contract PaymentTest {
    address immutable UTR;
    constructor(address _utr) {
        UTR = _utr;
    }
    function CallUTRPay(
        address sender,
        address recipient,
        uint eip,
        address token,
        uint id,
        uint amount
    ) external {
        IUniversalTokenRouter(UTR).pay(sender, recipient, eip, token, id, amount);
    }
}