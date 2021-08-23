// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMintGateway} from "../Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "../Gateways/interfaces/ILockGateway.sol";
import {RenAssetProxyBeaconV1, MintGatewayProxyBeaconV1, MintGatewayWithBurnStorageProxyBeaconV1, LockGatewayProxyBeaconV1} from "./ProxyBeacon.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RenAssetFactory is Initializable {
    RenAssetProxyBeaconV1 public renAssetProxyBeacon;
    MintGatewayProxyBeaconV1 public mintGatewayProxyBeacon;
    MintGatewayWithBurnStorageProxyBeaconV1 public mintGatewayWithBurnStorageProxyBeacon;
    LockGatewayProxyBeaconV1 public lockGatewayProxyBeacon;

    function __RenAssetFactory_init(
        address renAssetProxyBeacon_,
        address mintGatewayProxyBeacon_,
        address mintGatewayWithBurnStorageProxyBeacon_,
        address lockGatewayProxyBeacon_
    ) public initializer {
        renAssetProxyBeacon = RenAssetProxyBeaconV1(renAssetProxyBeacon_);
        mintGatewayProxyBeacon = MintGatewayProxyBeaconV1(mintGatewayProxyBeacon_);
        mintGatewayWithBurnStorageProxyBeacon = MintGatewayWithBurnStorageProxyBeaconV1(
            mintGatewayWithBurnStorageProxyBeacon_
        );
        lockGatewayProxyBeacon = LockGatewayProxyBeaconV1(lockGatewayProxyBeacon_);
    }

    function _deployRenAsset(
        uint256 chainId_,
        string calldata asset_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        string memory version_
    ) internal returns (IERC20) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__RenAsset_init(uint256,string,string,string,uint8)",
            chainId_,
            version_,
            name_,
            symbol_,
            decimals_
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset_, version_));

        address renAsset = renAssetProxyBeacon.deployProxy(create2Salt, encodedParameters);

        return IERC20(renAsset);
    }

    function _deployMintGateway(
        string memory chainName_,
        string calldata asset_,
        address signatureVerifier_,
        address token,
        string memory version_
    ) internal returns (IMintGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__MintGateway_init(string,string,address,address)",
            chainName_,
            asset_,
            signatureVerifier_,
            token
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset_, version_));

        address mintGateway = mintGatewayProxyBeacon.deployProxy(create2Salt, encodedParameters);

        Ownable(mintGateway).transferOwnership(msg.sender);

        return IMintGateway(mintGateway);
    }

    function _deployMintGatewayWithBurnStorage(
        string memory chainName_,
        string calldata asset_,
        address signatureVerifier_,
        address token,
        string memory version_
    ) internal returns (IMintGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__MintGateway_init(string,string,address,address)",
            chainName_,
            asset_,
            signatureVerifier_,
            token
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset_, version_));

        address mintGateway = mintGatewayProxyBeacon.deployProxy(create2Salt, encodedParameters);

        Ownable(mintGateway).transferOwnership(msg.sender);

        return IMintGateway(mintGateway);
    }

    function _deployLockGateway(
        string memory chainName_,
        string calldata asset_,
        address signatureVerifier_,
        address token,
        string memory version_
    ) internal returns (ILockGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__LockGateway_init(string,string,address,address)",
            chainName_,
            asset_,
            signatureVerifier_,
            token
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset_, version_));

        address lockGateway = lockGatewayProxyBeacon.deployProxy(create2Salt, encodedParameters);

        Ownable(lockGateway).transferOwnership(msg.sender);

        return ILockGateway(lockGateway);
    }
}
