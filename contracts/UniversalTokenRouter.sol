// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IUniversalTokenRouter.sol";

contract UniversalTokenRouter is IUniversalTokenRouter {
    function exec(
        Action[] calldata actions
    ) override external payable returns (
        uint[] memory results,
        uint gasLeft
    ) {
        results = new uint[](actions.length);
        uint value; // track the ETH value to pass to next output action transaction value
        for (uint i = 0; i < actions.length; ++i) {
            Action memory action = actions[i];
            if (!action.output) {
                // input action
                results[i] = _transfer(action);
                if (action.eip == 0 && action.recipient == address(0x0)) {
                    value = results[i]; // save the ETH value to pass to the next output call
                }
                continue;
            }
            // output action
            if (action.amount > 0) {
                // track the recipient balance before the action is executed
                results[i] = _balanceOf(action.recipient, action.token, action.eip, action.id);
            }
            if (action.code != address(0x0)) {
                (bool success, bytes memory result) = action.code.call{value: value}(action.data);
                if (!success) {
                    assembly {
                        revert(add(result,32),mload(result))
                    }
                }
                delete value; // clear the ETH value after transfer
            }
        }
        // refund any left-over ETH
        uint leftOver = address(this).balance;
        if (leftOver > 0) {
            TransferHelper.safeTransferETH(msg.sender, leftOver);
        }
        // verify the balance change
        for (uint i = 0; i < actions.length; ++i) {
            if (actions[i].output && actions[i].amount > 0) {
                uint balance = _balanceOf(actions[i].recipient, actions[i].token, actions[i].eip, actions[i].id);
                uint change = balance - results[i];
                require(change >= actions[i].amount, 'UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT');
                results[i] = change;
            }
        }
        gasLeft = gasleft();
    }

    function _transfer(Action memory action) internal returns (uint amount) {
        if (action.code != address(0x0)) {
            (bool success, bytes memory result) = action.code.call(action.data);
            if (!success) {
                assembly {
                    revert(add(result,32),mload(result))
                }
            }
            amount = abi.decode(result, (uint));
            require(amount <= action.amount, "UniversalTokenRouter: EXCESSIVE_INPUT_AMOUNT");
        } else {
            amount = action.amount;
        }

        if (amount == 0) {
            return 0;   // nothing to transfer
        }
        if (action.eip == 20) {
            TransferHelper.safeTransferFrom(action.token, msg.sender, action.recipient, amount);
            return amount;
        }
        if (action.eip == 1155) {
            IERC1155(action.token).safeTransferFrom(msg.sender, action.recipient, action.id, amount, "");
            return amount;
        }
        if (action.eip == 721) {
            IERC721(action.token).safeTransferFrom(msg.sender, action.recipient, action.id);
            return 1;
        }
        if (action.eip == 0) {
            // ETH not transfered here will be passed to the next output call value
            if (action.recipient != address(0x0)) {
                TransferHelper.safeTransferETH(action.recipient, amount);
            }
            return amount;
        }
        revert("UniversalTokenRouter: INVALID_EIP");
    }

    function _balanceOf(address owner, address token, uint eip, uint id) internal view returns (uint balance) {
        if (eip == 20) {
            return IERC20(token).balanceOf(owner);
        }
        if (eip == 1155) {
            return IERC1155(token).balanceOf(owner, id);
        }
        if (eip == 721) {
            return IERC721(token).ownerOf(id) == owner ? 1 : 0;
        }
        if (eip == 0) {
            return owner.balance;
        }
        revert("UniversalTokenRouter: INVALID_EIP");
    }
}
