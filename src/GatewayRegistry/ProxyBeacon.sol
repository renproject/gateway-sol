// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract ProxyBeaconV1 is Context, AccessControl, UpgradeableBeacon {
    bytes32 public constant PROXY_DEPLOYER = keccak256("PROXY_DEPLOYER");

    constructor(address implementation_, address adminAddress_) UpgradeableBeacon(implementation_) {
        AccessControl._setupRole(AccessControl.DEFAULT_ADMIN_ROLE, adminAddress_);
        transferOwnership(adminAddress_);
    }

    function deployProxy(bytes32 create2Salt, bytes calldata encodedParameters)
        external
        onlyRole(PROXY_DEPLOYER)
        returns (address)
    {
        return address(new BeaconProxy{salt: create2Salt}(address(this), encodedParameters));
    }
}

contract RenAssetProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation, address adminAddress) ProxyBeaconV1(implementation, adminAddress) {}
}

contract MintGatewayProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation, address adminAddress) ProxyBeaconV1(implementation, adminAddress) {}
}

contract LockGatewayProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation, address adminAddress) ProxyBeaconV1(implementation, adminAddress) {}
}
