// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "./RenProxyAdmin.sol";
import "./RenAsset/ERC20WithPermit.sol";
import "./RenAsset/RenAsset.sol";

import "./Gateways/LockGateway.sol";
import "./Gateways/MintGateway.sol";
import "./Gateways/RenVMSignatureVerifier.sol";

import "./GatewayRegistry/ProxyBeacon.sol";
import "./GatewayRegistry/RenAssetFactory.sol";
import "./GatewayRegistry/GatewayRegistry.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ERC20PresetMinterPauserUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

/// Bindings imports all of the contracts for generating bindings.
/* solium-disable-next-line no-empty-blocks */
contract Bindings {

}
