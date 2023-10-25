// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

contract AllowanceAdapter is ReentrancyGuard, ERC1155Holder, ERC721Holder {
    struct Input {
        uint256 eip; // token standard: 0 for ETH or EIP number
        address token; // token contract address
        uint256 id; // token id for EIP721 and EIP1155
        uint256 amountIn;
    }

    struct Output {
        uint256 eip; // token standard: 0 for ETH or EIP number
        address token; // token contract address
        uint256 id; // token id for EIP721 and EIP1155
    }

    uint256 constant EIP_ETH = 0;

    // accepting ETH for WETH.withdraw
    receive() external payable {}

    function approveAndCall(
        Input[] memory inputs,
        address spender,
        bytes memory data,
        Output[] memory outputs,
        address recipient
    ) external payable nonReentrant {
        for (uint256 i = 0; i < inputs.length; ++i) {
            Input memory input = inputs[i];
            _approve(input.eip, input.token, input.id, spender, input.amountIn);
        }

        (bool success, bytes memory result) = spender.call{value: msg.value}(
            data
        );
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        for (uint256 i = 0; i < inputs.length; ++i) {
            Input memory input = inputs[i];
            _approve(input.eip, input.token, input.id, spender, 0);
            uint256 leftOver = _balance(
                input.eip,
                input.token,
                input.id,
                address(this)
            );
            if (leftOver > 0) {
                _transfer(
                    input.eip,
                    input.token,
                    input.id,
                    leftOver,
                    recipient
                );
            }
        }
        for (uint256 i = 0; i < outputs.length; ++i) {
            Output memory output = outputs[i];
            uint256 amountOut = _balance(
                output.eip,
                output.token,
                output.id,
                address(this)
            );
            if (amountOut > 0) {
                _transfer(
                    output.eip,
                    output.token,
                    output.id,
                    amountOut,
                    recipient
                );
            }
        }
    }

    // IERC165-supportsInterface
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == 0x61206120 ||
            super.supportsInterface(interfaceId);
    }

    function _transfer(
        uint256 eip,
        address token,
        uint256 id,
        uint256 amount,
        address recipient
    ) internal {
        if (eip == 20) {
            TransferHelper.safeTransfer(token, recipient, amount);
        } else if (eip == 1155) {
            IERC1155(token).safeTransferFrom(
                address(this),
                recipient,
                id,
                amount,
                ""
            );
        } else if (eip == 721) {
            IERC721(token).safeTransferFrom(address(this), recipient, id);
        } else if (eip == EIP_ETH) {
            TransferHelper.safeTransferETH(recipient, amount);
        } else {
            revert("AllowanceAdapter: INVALID_EIP");
        }
    }

    function _approve(
        uint256 eip,
        address token,
        uint256 id,
        address spender,
        uint256 allowance
    ) internal {
        if (eip == 20) {
            IERC20(token).approve(spender, allowance);
        } else if (eip == 1155) {
            if (allowance == 0) {
                IERC1155(token).setApprovalForAll(spender, false);
            } else {
                IERC1155(token).setApprovalForAll(spender, true);
            }
        } else if (eip == 721) {
            if (allowance == 0) {
                try IERC721(token).ownerOf(id) {
                    IERC721(token).approve(address(0), id);
                } catch {
                    return;
                }
            } else {
                try IERC721(token).ownerOf(id) {
                    IERC721(token).approve(spender, id);
                } catch {
                    return;
                }
            }
        } else if (eip == EIP_ETH) {
            return;
        } else {
            revert("AllowanceAdapter: INVALID_EIP");
        }
    }

    function _balance(
        uint256 eip,
        address token,
        uint256 id,
        address account
    ) internal view returns (uint256) {
        if (eip == 20) {
            return IERC20(token).balanceOf(account);
        }
        if (eip == 1155) {
            return IERC1155(token).balanceOf(account, id);
        }
        if (eip == 721) {
            try IERC721(token).ownerOf(id) returns (address currentOwner) {
                return currentOwner == account ? 1 : 0;
            } catch {
                return 0;
            }
        }
        if (eip == EIP_ETH) {
            return account.balance;
        }
        revert("AllowanceAdapter: INVALID_EIP");
    }
}
