// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20WithPermit} from "./ERC20WithPermit.sol";

import "./ERC20WithPermit.sol";

contract RenAssetStateV2 {
    string public constant NAME = "RenAsset";

    uint8 internal _decimals;

    uint256[48] private __gap;
}

/// @notice RenERC20 represents a digital asset that has been bridged on to
/// the Ethereum ledger. It exposes mint and burn functions that can only be
/// called by it's associated Gateway contract.
contract RenAssetV2 is Initializable, ERC20Upgradeable, ERC20WithPermit, OwnableUpgradeable, RenAssetStateV2 {
    /* solium-disable-next-line no-empty-blocks */
    function __RenAsset_init(
        uint256 chainId_,
        string memory version_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) public initializer {
        ERC20Upgradeable.__ERC20_init(name_, symbol_);
        ERC20WithPermit.__ERC20WithPermit_init(chainId_, version_, name_, symbol_);
        OwnableUpgradeable.__Ownable_init();
        RenAssetStateV2._decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return RenAssetStateV2._decimals;
    }

    /// @notice mint can only be called by the tokens' associated Gateway
    /// contract. See Gateway's mint function instead.
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    /// @notice burn can only be called by the tokens' associated Gateway
    /// contract. See Gateway's burn functions instead.
    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // Disallow sending tokens to the ERC20 contract address - a common
        // mistake caused by the Ethereum transaction's `to` needing to be
        // the token's address.
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        // Disallow sending tokens to the ERC20 contract address (see comment
        // in `transfer`).
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transferFrom(sender, recipient, amount);
    }
}
