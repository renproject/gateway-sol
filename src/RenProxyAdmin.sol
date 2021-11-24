// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/// See ProxyAdmin.
contract RenProxyAdmin is Ownable, ProxyAdmin {
    string public constant NAME = "RenProxyAdmin";

    /// An address to be set as the owner is passed in so that RenProxyAdmin can
    /// be deployed by the CREATE2 deployer contract.
    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }
}
