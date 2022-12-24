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
        uint[][] memory results,
        uint gasLeft
    ) { unchecked {
        results = new uint[][](actions.length);
        uint value; // track the ETH value to pass to next output action transaction value
        bytes memory inputParams;
        for (uint i = 0; i < actions.length; ++i) {
            Action memory action = actions[i];
            results[i] = new uint[](action.tokens.length);
            if (action.inputOffset == 0) {
                // output action
                for (uint j = 0; j < action.tokens.length; ++j) {
                    Token memory token = action.tokens[j];
                    if (token.amount > 0) {
                        // track the recipient balance before the action is executed
                        results[i][j] = _balanceOf(token);
                    }
                }
                if (action.input.length > 0) {
                    (bool success, bytes memory result) = action.target.call{value: value}(action.input);
                    if (!success) {
                        assembly {
                            revert(add(result,32),mload(result))
                        }
                    }
                    delete value; // clear the ETH value after transfer
                }
                continue;
            }
            // input action
            if (action.input.length > 0) {
                bool success;
                (success, inputParams) = action.target.call(action.input);
                if (!success) {
                    assembly {
                        revert(add(inputParams,32),mload(inputParams))
                    }
                }
            }
            for (uint j = 0; j < action.tokens.length; ++j) {
                Token memory token = action.tokens[j];
                // input action
                if (action.input.length > 0) {
                    // TODO: handle negative inputOffset
                    uint amount = _sliceUint(inputParams, uint(action.inputOffset) + j*32);
                    require(amount <= token.amount, "UniversalTokenRouter: EXCESSIVE_INPUT_AMOUNT");
                    token.amount = amount;
                }
                results[i][j] = token.amount;
                if (token.eip == 0 && token.recipient == address(0x0)) {
                    value = token.amount;
                    continue; // ETH not transfered here will be passed to the next output call value
                }
                _transfer(token);
            }
        }
        // refund any left-over ETH
        uint leftOver = address(this).balance;
        if (leftOver > 0) {
            TransferHelper.safeTransferETH(msg.sender, leftOver);
        }
        // verify the balance change
        for (uint i = 0; i < actions.length; ++i) {
            if (actions[i].inputOffset != 0) {
                continue;
            }
            for (uint j = 0; j < actions[i].tokens.length; ++j) {
                Token memory token = actions[i].tokens[j];
                if (token.amount == 0) {
                    continue;
                }
                uint balance = _balanceOf(token);
                uint change = balance - results[i][j]; // overflow checked with `change <= balance` bellow
                require(change >= token.amount && change <= balance, 'UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT');
                results[i][j] = change;
            }
        }
        gasLeft = gasleft();
    } }

    // https://ethereum.stackexchange.com/a/54405
    function _sliceUint(bytes memory bs, uint start) internal pure returns (uint x) {
    unchecked {
        // require(bs.length >= start + 32, "slicing out of range");
        assembly {
            x := mload(add(bs, start))
        }
    } }

    function _transfer(Token memory token) internal {
    unchecked {
        if (token.amount == 0) {
            return;   // nothing to transfer
        } else if (token.eip == 20) {
            TransferHelper.safeTransferFrom(token.adr, msg.sender, token.recipient, token.amount);
        } else if (token.eip == 1155) {
            IERC1155(token.adr).safeTransferFrom(msg.sender, token.recipient, token.id, token.amount, "");
        } else if (token.eip == 721) {
            IERC721(token.adr).safeTransferFrom(msg.sender, token.recipient, token.id);
        } else if (token.eip == 0) {
            TransferHelper.safeTransferETH(token.recipient, token.amount);
        } else {
            revert("UniversalTokenRouter: INVALID_EIP");
        }
    } }

    function _balanceOf(Token memory token) internal view returns (uint balance) {
    unchecked {
        if (token.eip == 20) {
            return IERC20(token.adr).balanceOf(token.recipient);
        }
        if (token.eip == 1155) {
            return IERC1155(token.adr).balanceOf(token.recipient, token.id);
        }
        if (token.eip == 721) {
            return IERC721(token.adr).ownerOf(token.id) == token.recipient ? 1 : 0;
        }
        if (token.eip == 0) {
            return token.recipient.balance;
        }
        revert("UniversalTokenRouter: INVALID_EIP");
    } }
}
