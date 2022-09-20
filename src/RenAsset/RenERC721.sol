// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {ERC721WithPermit} from "./ERC721WithPermit.sol";
import {IRenAsset} from "./interfaces/IRenAsset.sol";
import {String} from "../libraries/String.sol";

contract RenERC721V1 is IRenAsset, Initializable, OwnableUpgradeable, ERC721WithPermit {
    string public constant NAME = "RenERC721";

    // If these parameters are changed, RenAssetFactory must be updated as well.
    function __RenERC721_init(
        uint256 chainId,
        string calldata version_,
        string calldata name_,
        string calldata symbol_,
        address contractOwner
    ) external initializer {
        require(String.isValidString(version_), "RenERC721: invalid version");
        require(String.isValidString(name_), "RenERC721: invalid name");
        require(String.isValidString(symbol_), "RenERC721: invalid symbol");

        __Ownable_init();
        __ERC721WithPermit_init(chainId, version_, name_, symbol_);

        if (owner() != contractOwner) {
            transferOwnership(contractOwner);
        }
    }

    /// @notice mint can only be called by the tokens' associated Gateway
    /// contract. See Gateway's mint function instead.
    function mint(address to, uint256 tokenId) external override onlyOwner {
        _mint(to, tokenId);
    }

    /// @notice burn can only be called by the tokens' associated Gateway
    /// contract. See Gateway's burn functions instead.
    function burn(address, uint256 tokenId) external override onlyOwner {
        _burn(tokenId);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 tokenId
    ) public override {
        // Disallow sending tokens to this contract address (see comment
        // in `transfer`).
        require(recipient != address(this), "RenERC721: can't transfer to token address");
        return super.transferFrom(sender, recipient, tokenId);
    }

    function transferOwnership(address newOwner) public override(IRenAsset, OwnableUpgradeable) {
        OwnableUpgradeable.transferOwnership(newOwner);
    }
}
