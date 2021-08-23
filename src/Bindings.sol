// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import "./RenAsset/ERC20WithPermit.sol";
import "./RenAsset/RenAsset.sol";

import "./Gateways/LockGateway.sol";
import "./Gateways/MintGateway.sol";
import "./Gateways/_MintGatewayWithBurnStorage.sol";

import "./GatewayRegistry/ProxyBeacon.sol";
import "./GatewayRegistry/RenAssetFactory.sol";
import "./GatewayRegistry/GatewayRegistry.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20PresetMinterPauserUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

/// @notice Bindings imports all of the contracts for generating bindings.
/* solium-disable-next-line no-empty-blocks */
contract Bindings {

}
