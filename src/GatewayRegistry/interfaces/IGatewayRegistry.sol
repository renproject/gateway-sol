// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMintGateway} from "../../Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "../../Gateways/interfaces/ILockGateway.sol";
import {ValidString} from "../../libraries/ValidString.sol";
import {RenAssetFactory} from "../RenAssetFactory.sol";

abstract contract IGatewayRegistry {
    address public signatureVerifier;
    uint256 public chainId;
    string public chainName;

    function getMintGatewaySymbols(uint256 from_, uint256 count_) external view virtual returns (string[] memory);

    function getLockGatewaySymbols(uint256 from_, uint256 count_) external view virtual returns (string[] memory);

    function getMintGatewayByToken(address token_) external view virtual returns (IMintGateway);

    function getMintGatewayBySymbol(string calldata tokenSymbol_) external view virtual returns (IMintGateway);

    function getRenAssetBySymbol(string calldata tokenSymbol_) external view virtual returns (IERC20);

    function getLockGatewayByToken(address token_) external view virtual returns (ILockGateway);

    function getLockGatewayBySymbol(string calldata tokenSymbol_) external view virtual returns (ILockGateway);

    function getLockAssetBySymbol(string calldata tokenSymbol_) external view virtual returns (IERC20);
}
