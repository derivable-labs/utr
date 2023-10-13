// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IUniversalTokenRouter.sol";

/// @title The implemetation of the EIP-6120.
/// @author Derivable Labs
contract UniversalTokenRouter is ERC165, IUniversalTokenRouter {
    uint256 constant PAYMENT       = 0;
    uint256 constant TRANSFER      = 1;
    uint256 constant CALL_VALUE    = 2;

    uint256 constant EIP_ETH       = 0;

    uint256 constant ERC_721_BALANCE = uint256(keccak256('UniversalTokenRouter.ERC_721_BALANCE'));

    bytes4 constant IERC721_safeTransferFrom =
        bytes4(keccak256("safeTransferFrom(address,address,uint256)"));
    bytes4 constant IERC721_safeTransferFromWithBytes =
        bytes4(keccak256("safeTransferFrom(address,address,uint256,bytes)"));
    bytes4 constant IERC1363_transferFromAndCall =
        bytes4(keccak256("transferFromAndCall(address,address,uint256)"));
    bytes4 constant IERC1363_transferFromAndCallWithBytes =
        bytes4(keccak256("transferFromAndCall(address,address,uint256,bytes)"));

    /// Pack all functions selectors that spend the token allowance to be
    /// blocked from the action.data calls.
    ///
    /// IERC721.transferFrom has the same selector with IERC20
    bytes32 constant BLOCKED_SELECTORS_0 =
        bytes32(IERC20.transferFrom.selector)                   |
        bytes32(IERC721_safeTransferFrom)                >>  32 |
        bytes32(IERC721_safeTransferFromWithBytes)       >>  64 |
        bytes32(IERC777.operatorSend.selector)           >>  96 |
        bytes32(IERC777.operatorBurn.selector)           >> 128 |
        bytes32(IERC1155.safeTransferFrom.selector)      >> 160 |
        bytes32(IERC1155.safeBatchTransferFrom.selector) >> 192 |
        bytes32(IERC1363_transferFromAndCall)            >> 224 ;
    
    /// IERC1363_transferFromAndCallWithBytes and up to 7 custom selectors
    bytes32 immutable BLOCKED_SELECTORS_1;

    /// @dev transient pending payments
    mapping(bytes32 => uint256) t_payments;

    /// Construct the UTR with optional custom function selectors to be blocked
    /// from the action.data.
    /// 
    /// @param blockedSelectors up to 7 function selectors (4 bytes each),
    /// and the last 4-bytes are discarded. These selectors can be added for
    /// future token standard/extension functions that spend their allowances.
    constructor(bytes32 blockedSelectors) {
        BLOCKED_SELECTORS_1 =
            bytes32(IERC1363_transferFromAndCallWithBytes) |
            blockedSelectors >> 32;
    }

    /// @dev accepting ETH for user execution (e.g. WETH.withdraw)
    receive() external payable {}

    /// The main entry point of the router
    /// @param outputs token behaviour for output verification
    /// @param actions router actions and inputs for execution
    function exec(
        Output[] memory outputs,
        Action[] memory actions
    ) external payable virtual override {
    unchecked {
        // track the expected balances before any action is executed
        for (uint256 i = 0; i < outputs.length; ++i) {
            Output memory output = outputs[i];
            uint256 balance = _balanceOf(output);
            uint256 expected = output.amountOutMin + balance;
            require(expected >= balance, 'UniversalTokenRouter: OUTPUT_BALANCE_OVERFLOW');
            output.amountOutMin = expected;
        }

        address sender = msg.sender;

        for (uint256 i = 0; i < actions.length; ++i) {
            Action memory action = actions[i];
            uint256 value;
            for (uint256 j = 0; j < action.inputs.length; ++j) {
                Input memory input = action.inputs[j];
                uint256 mode = input.mode;
                if (mode == CALL_VALUE) {
                    // eip and id are ignored
                    value = input.amountIn;
                } else {
                    if (mode == PAYMENT) {
                        bytes32 key = keccak256(abi.encode(sender, input.recipient, input.eip, input.token, input.id));
                        t_payments[key] = input.amountIn;
                    } else if (mode == TRANSFER) {
                        _transferToken(sender, input.recipient, input.eip, input.token, input.id, input.amountIn);
                    } else {
                        revert('UniversalTokenRouter: INVALID_MODE');
                    }
                }
            }
            if (action.code != address(0) || action.data.length > 0 || value > 0) {
                if (action.data.length >= 4) {
                    _checkSelector(
                        bytes4(action.data[0])       |
                        bytes4(action.data[1]) >>  8 |
                        bytes4(action.data[2]) >> 16 |
                        bytes4(action.data[3]) >> 24
                    );
                }
                (bool success, bytes memory result) = action.code.call{value: value}(action.data);
                if (!success) {
                    assembly {
                        revert(add(result,32),mload(result))
                    }
                }
            }
            // clear all transient storages
            for (uint256 j = 0; j < action.inputs.length; ++j) {
                Input memory input = action.inputs[j];
                if (input.mode == PAYMENT) {
                    // transient storages
                    bytes32 key = keccak256(abi.encodePacked(
                        sender, input.recipient, input.eip, input.token, input.id
                    ));
                    delete t_payments[key];
                }
            }
        }

        // refund any left-over ETH
        uint256 leftOver = address(this).balance;
        if (leftOver > 0) {
            TransferHelper.safeTransferETH(sender, leftOver);
        }

        // verify balance changes
        for (uint256 i = 0; i < outputs.length; ++i) {
            Output memory output = outputs[i];
            uint256 balance = _balanceOf(output);
            // NOTE: output.amountOutMin is reused as `expected`
            require(balance >= output.amountOutMin, 'UniversalTokenRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        }
    } }
    
    /// Spend the pending payment. Intended to be called from the input.action.
    /// @param payment encoded payment data
    /// @param amount token amount to pay with payment
    function pay(bytes memory payment, uint256 amount) external virtual override {
        discard(payment, amount);
        (
            address sender,
            address recipient,
            uint256 eip,
            address token,
            uint256 id
        ) = abi.decode(payment, (address, address, uint256, address, uint256));
        _transferToken(sender, recipient, eip, token, id, amount);
    }

    /// Discard a part of a pending payment. Can be called from the input.action
    /// to verify the payment without transfering any token.
    /// @param payment encoded payment data
    /// @param amount token amount to pay with payment
    function discard(bytes memory payment, uint256 amount) public virtual override {
        bytes32 key = keccak256(payment);
        require(t_payments[key] >= amount, 'UniversalTokenRouter: INSUFFICIENT_PAYMENT');
        unchecked {
            t_payments[key] -= amount;
        }
    }

    // IERC165-supportsInterface
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IUniversalTokenRouter).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _transferToken(
        address sender,
        address recipient,
        uint256 eip,
        address token,
        uint256 id,
        uint256 amount
    ) internal virtual {
        if (eip == 20) {
            TransferHelper.safeTransferFrom(token, sender, recipient, amount);
        } else if (eip == 1155) {
            IERC1155(token).safeTransferFrom(sender, recipient, id, amount, "");
        } else if (eip == 721) {
            IERC721(token).safeTransferFrom(sender, recipient, id);
        } else {
            revert("UniversalTokenRouter: INVALID_EIP");
        }
    }

    function _balanceOf(
        Output memory output
    ) internal view virtual returns (uint256 balance) {
        uint256 eip = output.eip;
        if (eip == 20) {
            return IERC20(output.token).balanceOf(output.recipient);
        }
        if (eip == 1155) {
            return IERC1155(output.token).balanceOf(output.recipient, output.id);
        }
        if (eip == 721) {
            if (output.id == ERC_721_BALANCE) {
                return IERC721(output.token).balanceOf(output.recipient);
            }
            try IERC721(output.token).ownerOf(output.id) returns (address currentOwner) {
                return currentOwner == output.recipient ? 1 : 0;
            } catch {
                return 0;
            }
        }
        if (eip == EIP_ETH) {
            return output.recipient.balance;
        }
        revert("UniversalTokenRouter: INVALID_EIP");
    }

    function _checkSelector(bytes4 selector) internal view {
        for (bytes32 selectors = BLOCKED_SELECTORS_0; selectors != 0; selectors <<= 32) {
            require(selector != bytes4(selectors), "UniversalTokenRouter: FUNCTION_BLOCKED");
        }
        for (bytes32 selectors = BLOCKED_SELECTORS_1; selectors != 0; selectors <<= 32) {
            require(selector != bytes4(selectors), "UniversalTokenRouter: FUNCTION_BLOCKED");
        }
    }
}
