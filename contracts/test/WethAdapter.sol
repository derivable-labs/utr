// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "../NotToken.sol";

// sample adapter contract for WETH
contract WethAdapter is NotToken {
    address immutable WETH;

    constructor(address _weth) {
        WETH = _weth;
    }

    receive() external payable {
        IWETH(WETH).deposit{value: msg.value}();
        TransferHelper.safeTransfer(WETH, msg.sender, msg.value);
    }

    fallback() external payable {
        IWETH(WETH).deposit{value: msg.value}();
        TransferHelper.safeTransfer(WETH, msg.sender, msg.value);
    }

    function deposit(address recipient) external payable {
        IWETH(WETH).deposit{value: msg.value}();
        TransferHelper.safeTransfer(WETH, recipient, msg.value);
    }

    function doRevert(string memory reason) external pure {
        revert(reason);
    }
}
