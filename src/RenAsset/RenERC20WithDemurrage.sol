// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {IRenAsset} from "./interfaces/IRenAsset.sol";
import {ERC20WithPermit} from "./ERC20WithPermit.sol";
import {String} from "../libraries/String.sol";

abstract contract RenERC20WithDemurrageStateV1 {
    uint8 internal _decimals;
    uint256 public _exchangeRate = 50;
    uint256 public _demourageRateMantissa;
    uint256 public _demourageRateBase = 10**18;
    uint256 public _blockNumber;

    // Leave a gap so that storage values added in future upgrages don't corrupt
    // the storage of contracts that inherit from this contract.
    uint256[45] private __gap;
}

contract RenERC20WithDemurrageV1 is IRenAsset, Initializable, OwnableUpgradeable, ERC20Upgradeable, ERC20WithPermit, RenERC20WithDemurrageStateV1 {
    string public constant NAME = "RenERC20WithDemurrage";

    // If these parameters are changed, RenERC20WithDemurrageFactory must be updated as well.
    function __RenERC20WithDemurrage_init(
        uint256 chainId,
        string calldata version_,
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        uint256 demourageRateMantissa_,
        address contractOwner
    ) external initializer {
        require(String.isValidString(version_), "RenERC20WithDemurrage: invalid version");
        require(String.isValidString(name_), "RenERC20WithDemurrage: invalid name");
        require(String.isValidString(symbol_), "RenERC20WithDemurrage: invalid symbol");

        __Ownable_init();
        __ERC20_init(name_, symbol_);
        __ERC20WithPermit_init(chainId, version_, name_, symbol_);

        RenERC20WithDemurrageStateV1._decimals = decimals_;
        RenERC20WithDemurrageStateV1._demourageRateMantissa = demourageRateMantissa_;

        if (owner() != contractOwner) {
            transferOwnership(contractOwner);
        }
    }

    function decimals() public view override returns (uint8) {
        return RenERC20WithDemurrageStateV1._decimals;
    }

    /// @notice mint can only be called by the tokens' associated Gateway
    /// contract. See Gateway's mint function instead.
    function mint(address to, uint256 amount) external override onlyOwner {
        uint256 mintAmount;
        if (RenERC20WithDemurrageStateV1._blockNumber == 0) {
            RenERC20WithDemurrageStateV1._blockNumber = block.number;
            mintAmount = amount * RenERC20WithDemurrageStateV1._exchangeRate;
        } else {
            mintAmount =
                (amount *
                    RenERC20WithDemurrageStateV1._exchangeRate *
                    (block.number - RenERC20WithDemurrageStateV1._blockNumber) *
                    RenERC20WithDemurrageStateV1._demourageRateMantissa) /
                RenERC20WithDemurrageStateV1._demourageRateBase;
        }
        _mint(to, mintAmount);
    }

    /// @notice burn can only be called by the tokens' associated Gateway
    /// contract. See Gateway's burn functions instead.
    function burn(address from, uint256 amount) external override onlyOwner {
        return _burn(from, tokenAmount(amount));
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // Disallow sending tokens to the ERC20 contract address - a common
        // mistake caused by the Ethereum transaction's `to` needing to be
        // the token's address.
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transfer(recipient, tokenAmount(amount));
    }

    function transferUnderlying(address recipient, uint256 amount) public returns (bool) {
        return transfer(recipient, tokenAmount(amount));
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

    function transferFromUnderlying(
        address sender,
        address recipient,
        uint256 amount
    ) public returns (bool) {
        transferFromUnderlying(sender, recipient, tokenAmount(amount));
    }

    function balanceOfUnderlying(address _owner) public view returns (uint256) {
        return underlyingAmount(balanceOf(_owner));
    }

    function approveUnderlying(address recipient, uint256 amount) public returns (bool) {
        return super.approve(recipient, tokenAmount(amount));
    }

    function allowanceUnderlying(address sender, address recipient) public view returns (uint256) {
        return underlyingAmount(super.allowance(sender, recipient));
    }

    function underlyingAmount(uint256 amount) public view returns (uint256) {
        return amount / newExchangeRate();
    }

    function tokenAmount(uint256 underlyingTokenAmount) public view returns (uint256) {
        return underlyingTokenAmount * newExchangeRate();
    }

    function newExchangeRate() public view returns (uint256) {
        if (RenERC20WithDemurrageStateV1._blockNumber == 0 || block.number == RenERC20WithDemurrageStateV1._blockNumber)
            return RenERC20WithDemurrageStateV1._exchangeRate;
        return
            (RenERC20WithDemurrageStateV1._exchangeRate *
                (RenERC20WithDemurrageStateV1._demourageRateBase + RenERC20WithDemurrageStateV1._demourageRateMantissa) **
                    (block.number - RenERC20WithDemurrageStateV1._blockNumber)) /
            (RenERC20WithDemurrageStateV1._demourageRateBase**(block.number - RenERC20WithDemurrageStateV1._blockNumber));
    }

    function updateDemourageRate(uint256 _newRate) public onlyOwner {
        RenERC20WithDemurrageStateV1._exchangeRate = newExchangeRate();
        RenERC20WithDemurrageStateV1._blockNumber = block.number;
        RenERC20WithDemurrageStateV1._demourageRateMantissa = _newRate;
    }

    function transferOwnership(address newOwner) public override(IRenAsset, OwnableUpgradeable) {
        OwnableUpgradeable.transferOwnership(newOwner);
    }
}
