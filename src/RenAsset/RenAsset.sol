// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {ERC20WithPermit} from "./ERC20WithPermit.sol";
import {String} from "../libraries/String.sol";

abstract contract RenAssetStateV3 {
    uint8 internal _decimals;
    uint256 public _exchangeRate = 50;
    uint256 public _demourageRateMantissa;
    uint256 public _demourageRateBase = 10**18;
    uint256 public _blockNumber;

    // Leave a gap so that storage values added in future upgrages don't corrupt
    // the storage of contracts that inherit from this contract.
    uint256[45] private __gap;
}

/// @title A title that should describe the contract/interface
/// @author The name of the author
/// @notice Explain to an end user what this does
/// @dev Explain to a developer any extra details
contract RenAssetV3 is Initializable, OwnableUpgradeable, ERC20Upgradeable, ERC20WithPermit, RenAssetStateV3 {
    string public constant NAME = "RenAsset";

    // If these parameters are changed, RenAssetFactory must be updated as well.
    function __RenAsset_init(
        uint256 chainId,
        string calldata version_,
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        uint256 demourageRateMantissa_,
        address contractOwner
    ) external initializer {
        require(String.isValidString(version_), "RenAsset: invalid version");
        require(String.isValidString(name_), "RenAsset: invalid name");
        require(String.isValidString(symbol_), "RenAsset: invalid symbol");

        __Ownable_init();
        __ERC20_init(name_, symbol_);
        __ERC20WithPermit_init(chainId, version_, name_, symbol_);

        RenAssetStateV3._decimals = decimals_;
        RenAssetStateV3._demourageRateMantissa = demourageRateMantissa_;

        if (owner() != contractOwner) {
            transferOwnership(contractOwner);
        }
    }

    function decimals() public view override returns (uint8) {
        return RenAssetStateV3._decimals;
    }

    /// @notice mint can only be called by the tokens' associated Gateway
    /// contract. See Gateway's mint function instead.
    function mint(address to, uint256 amount) external onlyOwner {
        uint256 mintAmount;
        if (RenAssetStateV3._blockNumber == 0) {
            RenAssetStateV3._blockNumber = block.number;
            mintAmount = amount * RenAssetStateV3._exchangeRate;
        } else {
            mintAmount =
                (amount *
                    RenAssetStateV3._exchangeRate *
                    (block.number - RenAssetStateV3._blockNumber) *
                    RenAssetStateV3._demourageRateMantissa) /
                RenAssetStateV3._demourageRateBase;
        }
        _mint(to, mintAmount);
    }

    /// @notice burn can only be called by the tokens' associated Gateway
    /// contract. See Gateway's burn functions instead.
    function burn(address from, uint256 amount) external onlyOwner {
        return _burn(from, tokenAmount(amount));
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // Disallow sending tokens to the ERC20 contract address - a common
        // mistake caused by the Ethereum transaction's `to` needing to be
        // the token's address.
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transfer(recipient, tokenAmount(amount));
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        // Disallow sending tokens to the ERC20 contract address (see comment
        // in `transfer`).
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transferFrom(sender, recipient, tokenAmount(amount));
    }

    function balanceOf(address _owner) public view override returns (uint256) {
        return underlyingAmount(balanceOf(_owner));
    }

    function approve(address recipient, uint256 amount) public override returns (bool) {
        return super.approve(recipient, tokenAmount(amount));
    }

    function allowance(address sender, address recipient) public view override returns (uint256) {
        return underlyingAmount(super.allowance(sender, recipient));
    }

    function underlyingAmount(uint256 amount) public view returns (uint256) {
        return amount / newExchangeRate();
    }

    function tokenAmount(uint256 underlyingTokenAmount) public view returns (uint256) {
        return underlyingTokenAmount * newExchangeRate();
    }

    function newExchangeRate() public view returns (uint256) {
        if (RenAssetStateV3._blockNumber == 0 || block.number == RenAssetStateV3._blockNumber)
            return RenAssetStateV3._exchangeRate;
        return
            (RenAssetStateV3._exchangeRate *
                (RenAssetStateV3._demourageRateBase + RenAssetStateV3._demourageRateMantissa) **
                    (block.number - RenAssetStateV3._blockNumber)) /
            (RenAssetStateV3._demourageRateBase**(block.number - RenAssetStateV3._blockNumber));
    }

    function updateDemourageRate(uint256 _newRate) public onlyOwner {
        RenAssetStateV3._exchangeRate = newExchangeRate();
        RenAssetStateV3._blockNumber = block.number;
        RenAssetStateV3._demourageRateMantissa = _newRate;
    }
}
