// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract ProxyBeaconV1 is AccessControl, UpgradeableBeacon {
    bytes32 public constant PROXY_DEPLOYER = keccak256("PROXY_DEPLOYER");

    constructor(address implementation_, address adminAddress_) UpgradeableBeacon(implementation_) {
        AccessControl._setupRole(AccessControl.DEFAULT_ADMIN_ROLE, adminAddress_);
    }

    function deployProxy(bytes32 create2Salt, bytes calldata encodedParameters)
        public
        onlyRole(PROXY_DEPLOYER)
        returns (address)
    {
        address proxy = address(new BeaconProxy{salt: create2Salt}(address(this), ""));

        Address.functionCall(address(proxy), encodedParameters);

        Ownable(address(proxy)).transferOwnership(msg.sender);

        return proxy;
    }
}

contract RenAssetProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation_, address adminAddress_) ProxyBeaconV1(implementation_, adminAddress_) {}
}

contract MintGatewayProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation_, address adminAddress_) ProxyBeaconV1(implementation_, adminAddress_) {}
}

contract MintGatewayWithBurnStorageProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation_, address adminAddress_) ProxyBeaconV1(implementation_, adminAddress_) {}
}

contract LockGatewayProxyBeaconV1 is ProxyBeaconV1 {
    constructor(address implementation_, address adminAddress_) ProxyBeaconV1(implementation_, adminAddress_) {}
}
