// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";

// sample adapter contract for WETH
contract WethAdapter {
    address immutable WETH;
    constructor(address _weth) {
        WETH = _weth;
    }

    function deposit(address recipient) external payable {
        IWETH(WETH).deposit{value: msg.value}();
        TransferHelper.safeTransfer(WETH, recipient, msg.value);
    }
}