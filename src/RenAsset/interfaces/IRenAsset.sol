// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

abstract contract IRenAsset {
    function transferOwnership(address newOwner) external virtual;
    function mint(address to, uint256 amountOrTokenId) external virtual;
    function burn(address from, uint256 amountOrTokenId) external virtual;
}
