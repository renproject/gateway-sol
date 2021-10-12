// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    string public constant DESCRIPTION = "Test token used by testnet RenVM - https://docs.renproject.io/";

    uint8 internal _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        address totalSupplyRecipient
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        ERC20._mint(totalSupplyRecipient, totalSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
