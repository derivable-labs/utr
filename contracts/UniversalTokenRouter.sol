// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IUniversalTokenRouter.sol";

contract UniversalTokenRouter is IUniversalTokenRouter {
    uint constant AMOUNT_INS_PLACEHOLDER = uint(keccak256('UniversalTokenRouter.AMOUNT_INS_PLACEHOLDER'));
    uint constant EIP_721_ALL = uint(keccak256('UniversalTokenRouter.EIP_721_ALL'));

    function exec(
        Action[] calldata actions
    ) override external payable {
    unchecked {
        uint[][] memory amounts = new uint[][](actions.length);
        // results = new bytes[](actions.length);
        uint value; // track the ETH value to pass to next output action transaction value
        bytes memory amountIns;
        for (uint i = 0; i < actions.length; ++i) {
            Action memory action = actions[i];
            if (action.output > 0) {
                // output action
                amounts[i] = new uint[](action.tokens.length);
                for (uint j = 0; j < action.tokens.length; ++j) {
                    Token memory token = action.tokens[j];
                    if (token.amount > 0) {
                        // track the recipient balance before the action is executed
                        amounts[i][j] = _balanceOf(token);
                    }
                }
                if (action.data.length > 0) {
                    uint length = action.data.length;
                    if (length >= 4+32*3 &&
                        _sliceUint(action.data, length) == AMOUNT_INS_PLACEHOLDER &&
                        _sliceUint(action.data, length-32) == 32)
                    {
                        action.data = _concat(action.data, length-32, amountIns);
                    }
                    (bool success, bytes memory result) = action.code.call{value: value}(action.data);
                    // ignore output action error if output == 2
                    if (!success && action.output == 2) {
                        assembly {
                            revert(add(result,32),mload(result))
                        }
                    }
                    // results[i] = result;
                    delete value; // clear the ETH value after transfer
                }
                continue;
            }
            // input action
            // amounts[i] = new uint[](action.tokens.length);
            if (action.data.length > 0) {
                bool success;
                (success, amountIns) = action.code.call(action.data);
                if (!success) {
                    assembly {
                        revert(add(amountIns,32),mload(amountIns))
                    }
                }
                // results[i] = inputParams;
            }
            for (uint j = 0; j < action.tokens.length; ++j) {
                Token memory token = action.tokens[j];
                if (token.offset >= 32) {
                    // require(inputParams.length > 0, "UniversalTokenRouter: OFFSET_OF_EMPTY_INPUT");
                    uint amount = _sliceUint(amountIns, token.offset);
                    require(amount <= token.amount, "UniversalTokenRouter: EXCESSIVE_INPUT_AMOUNT");
                    token.amount = amount;
                }
                // amounts[i][j] = token.amount;
                if (token.eip == 0 && token.recipient == address(0x0)) {
                    value = token.amount;
                    continue; // ETH not transfered here will be passed to the next output call value
                }
                if (token.amount > 0) {
                    _transfer(token);
                }
            }
        }
        // refund any left-over ETH
        uint leftOver = address(this).balance;
        if (leftOver > 0) {
            TransferHelper.safeTransferETH(msg.sender, leftOver);
        }
        // verify the balance change
        for (uint i = 0; i < actions.length; ++i) {
            if (actions[i].output == 0) {
                continue;
            }
            for (uint j = 0; j < actions[i].tokens.length; ++j) {
                Token memory token = actions[i].tokens[j];
                if (token.amount == 0) {
                    continue;
                }
                uint balance = _balanceOf(token);
                uint change = balance - amounts[i][j]; // overflow checked with `change <= balance` bellow
                require(change >= token.amount && change <= balance, 'UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT');
                amounts[i][j] = change;
            }
        }
        // gasLeft = gasleft();
    } }

    function _transfer(Token memory token) internal {
    unchecked {
        if (token.eip == 20) {
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
            if (token.id == EIP_721_ALL) {
                return IERC721(token.adr).balanceOf(token.recipient);
            }
            return IERC721(token.adr).ownerOf(token.id) == token.recipient ? 1 : 0;
        }
        if (token.eip == 0) {
            return token.recipient.balance;
        }
        revert("UniversalTokenRouter: INVALID_EIP");
    } }

    // https://ethereum.stackexchange.com/a/54405
    function _sliceUint(bytes memory bs, uint start) internal pure returns (uint x) {
    unchecked {
        // require(bs.length >= start + 32, "slicing out of range");
        assembly {
            x := mload(add(bs, start))
        }
    } }

    // https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
    function _concat(
        bytes memory preBytes,
        uint length,
        bytes memory postBytes
    )
        internal
        pure
        returns (bytes memory bothBytes)
    {
        assembly {
            // Get a location of some free memory and store it in bothBytes as
            // Solidity does for memory variables.
            bothBytes := mload(0x40)

            // Store the length of the first bytes array at the beginning of
            // the memory for bothBytes.
            mstore(bothBytes, length)

            // Maintain a memory counter for the current write location in the
            // temp bytes array by adding the 32 bytes for the array length to
            // the starting location.
            let mc := add(bothBytes, 0x20)
            // Stop copying when the memory counter reaches the length of the
            // first bytes array.
            let end := add(mc, length)

            for {
                // Initialize a copy counter to the start of the preBytes data,
                // 32 bytes into its memory.
                let cc := add(preBytes, 0x20)
            } lt(mc, end) {
                // Increase both counters by 32 bytes each iteration.
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                // Write the preBytes data into the bothBytes memory 32 bytes
                // at a time.
                mstore(mc, mload(cc))
            }

            // Add the length of postBytes to the current length of bothBytes
            // and store it as the new length in the first 32 bytes of the
            // bothBytes memory.
            length := mload(postBytes)
            mstore(bothBytes, add(length, mload(bothBytes)))

            // Move the memory counter back from a multiple of 0x20 to the
            // actual end of the preBytes data.
            mc := sub(end, 0x20)
            // Stop copying when the memory counter reaches the new combined
            // length of the arrays.
            end := add(end, length)

            for {
                let cc := postBytes
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            // Update the free-memory pointer by padding our last write location
            // to 32 bytes: add 31 bytes to the end of bothBytes to move to the
            // next 32 byte block, then round down to the nearest multiple of
            // 32. If the sum of the length of the two arrays is zero then add
            // one before rounding down to leave a blank 32 bytes (the length block with 0).
            mstore(0x40, and(
              add(add(end, iszero(add(length, mload(preBytes)))), 31),
              not(31) // Round down to the nearest 32 bytes.
            ))
        }
    }
}
