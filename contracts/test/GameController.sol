// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../NotToken.sol";
import "./GameItem.sol";

contract GameController is NotToken {
    GameItem immutable GAME_TOKEN;

    constructor(GameItem gameToken) {
        GAME_TOKEN = gameToken;
    }

    function awardItem(
        address player,
        string memory tokenURI
    ) public returns (uint256) {
        return GAME_TOKEN.awardItem(player, tokenURI);
    }

    function awardItems(
        uint256 amount,
        address player,
        string memory tokenURI
    ) public {
        return GAME_TOKEN.awardItems(amount, player, tokenURI);
    }

    function upgradeItem(
        address player,
        uint256 id,
        string memory tokenURI
    ) public returns (uint256) {
        return GAME_TOKEN.upgradeItem(player, id, tokenURI);
    }
}
