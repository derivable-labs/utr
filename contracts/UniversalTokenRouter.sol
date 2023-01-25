// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IUniversalTokenRouter.sol";

contract UniversalTokenRouter is IUniversalTokenRouter {
    uint constant TOKEN_SENDER_TRANSFER     = 0;
    uint constant TOKEN_ROUTER_TRANSFER     = 1;
    uint constant TOKEN_NEXT_CALL_VALUE     = 2;
    uint constant TOKEN_ALLOWANCE_BRIDGE    = 4;
    uint constant TOKEN_ALLOWANCE_CALLBACK  = 8;

    uint constant AMOUNT_EXACT      = 0;
    uint constant AMOUNT_ALL        = 1;

    uint constant EIP_ETH           = 0;

    uint constant ID_721_ALL = uint(keccak256('UniversalTokenRouter.ID_721_ALL'));

    uint constant ACTION_FAILABLE                   = 1;
    uint constant ACTION_RECORD_INPUT_RESULT        = 2;
    uint constant ACTION_INJECT_INPUT_RESULT        = 4;
    uint constant ACTION_FORWARD_CALLBACK           = 8;

    function exec(
        Output[] memory outputs,
        Action[] memory actions
    ) override external payable {
    unchecked {
        // track the expected balances before any action is executed
        for (uint i = 0; i < outputs.length; ++i) {
            Output memory output = outputs[i];
            uint balance = _balanceOf(output.recipient, output.eip, output.token, output.id);
            uint expected = output.amountOutMin + balance;
            require(expected >= balance, 'UniversalTokenRouter: OVERFLOW');
            output.amountOutMin = expected;
        }

        uint value;
        bytes memory lastInputResult;
        for (uint i = 0; i < actions.length; ++i) {
            Action memory action = actions[i];
            Transfer[] memory transfers = action.transfers;
            for (uint j = 0; j < transfers.length; ++j) {
                Transfer memory transfer = transfers[j];
                address sender = transfer.mode == TOKEN_ROUTER_TRANSFER ? address(this) : msg.sender; 
                uint amount;
                if (transfer.amountSource == AMOUNT_EXACT) {
                    amount = transfer.amountInMax;
                } else {
                    if (transfer.amountSource == AMOUNT_ALL) {
                        amount = _balanceOf(sender, transfer.eip, transfer.token, transfer.id);
                    } else {
                        amount = _sliceUint(lastInputResult, transfer.amountSource);
                    }
                    if (amount > 0 && transfer.amountInMax > 0) {
                        require(amount <= transfer.amountInMax, "UniversalTokenRouter: EXCESSIVE_INPUT_AMOUNT");
                    }
                }
                if (transfer.mode == TOKEN_NEXT_CALL_VALUE) {
                    value = amount;
                    continue;
                }
                if (transfer.mode == TOKEN_SENDER_TRANSFER || transfer.mode == TOKEN_ROUTER_TRANSFER) {
                    _transferToken(sender, transfer.recipient, transfer.eip, transfer.token, transfer.id, amount);
                    continue;
                }
                // TODO: TOKEN_ALLOWANCE_BRIDGE
                // TODO: TOKEN_ALLOWANCE_CALLBACK
            }
            if (action.data.length > 0) {
                // TODO: ACTION_FORWARD_CALLBACK
                if (action.flags & ACTION_INJECT_INPUT_RESULT != 0) {
                    // TODO: remove this length
                    action.data = _concat(action.data, action.data.length, lastInputResult);
                }
                (bool success, bytes memory result) = action.code.call{value: value}(action.data);
                if (!success && action.flags & ACTION_FAILABLE == 0) {
                    assembly {
                        revert(add(result,32),mload(result))
                    }
                }
                delete value;   // clear the ETH value after call
                if (action.flags & ACTION_RECORD_INPUT_RESULT != 0) {
                    lastInputResult = result;
                }
            }
        }

        for (uint i = 0; i < outputs.length; ++i) {
            Output memory output = outputs[i];
            uint balance = _balanceOf(output.recipient, output.eip, output.token, output.id);
            require(balance >= output.amountOutMin, 'UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        }

        // refund any left-over ETH
        uint leftOver = address(this).balance;
        if (leftOver > 0) {
            TransferHelper.safeTransferETH(msg.sender, leftOver);
        }
    } }

    function _transferToken(
        address sender,
        address recipient,
        uint eip,
        address token,
        uint id,
        uint amount
    ) internal {
        if (eip == 20) {
            if (sender == address(this)) {
                TransferHelper.safeTransfer(token, recipient, amount);
            } else {
                TransferHelper.safeTransferFrom(token, sender, recipient, amount);
            }
        } else if (eip == 1155) {
            IERC1155(token).safeTransferFrom(sender, recipient, id, amount, "");
        } else if (eip == 721) {
            IERC721(token).safeTransferFrom(sender, recipient, id);
        } else if (eip == EIP_ETH) {
            require(sender == address(this), 'UniversalTokenRouter: INVALID_ETH_SENDER');
            TransferHelper.safeTransferETH(recipient, amount);
        } else {
            revert("UniversalTokenRouter: INVALID_EIP");
        }
    }

    function _balanceOf(
        address owner,
        uint eip,
        address token,
        uint id
    ) internal view returns (uint balance) {
        if (eip == 20) {
            return IERC20(token).balanceOf(owner);
        }
        if (eip == 1155) {
            return IERC1155(token).balanceOf(owner, id);
        }
        if (eip == 721) {
            if (id == ID_721_ALL) {
                return IERC721(token).balanceOf(owner);
            }
            try IERC721(token).ownerOf(id) returns (address currentOwner) {
                return currentOwner == owner ? 1 : 0;
            } catch {
                return 0;
            }
        }
        if (eip == EIP_ETH) {
            return owner.balance;
        }
        revert("UniversalTokenRouter: INVALID_EIP");
    }

    function _sliceUint(bytes memory bs, uint start) internal pure returns (uint x) {
        // require(bs.length >= start + 32, "slicing out of range");
        assembly {
            x := mload(add(bs, start))
        }
    }

    /// https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
    /// @param length length of the first preBytes
    function _concat(
        bytes memory preBytes,
        uint length,
        bytes memory postBytes
    ) internal pure returns (bytes memory bothBytes) {
        // TODO: just use memory from 0x0
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
            // mstore(0x40, and(
            //   add(add(end, iszero(add(length, mload(preBytes)))), 31),
            //   not(31) // Round down to the nearest 32 bytes.
            // ))
        }
    }
}
