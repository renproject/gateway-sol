// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract RenProxyAdmin is Ownable, ProxyAdmin {
    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }
}
