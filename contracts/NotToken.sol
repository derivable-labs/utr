// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract NotToken is ERC165 {
    // IERC165-supportsInterface
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == 0x61206120 ||
            super.supportsInterface(interfaceId);
    }
}
