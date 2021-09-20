// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMintGateway} from "../Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "../Gateways/interfaces/ILockGateway.sol";
import {RenAssetProxyBeaconV1, MintGatewayProxyBeaconV1, LockGatewayProxyBeaconV1} from "./ProxyBeacon.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RenAssetFactoryState {
    RenAssetProxyBeaconV1 internal _renAssetProxyBeacon;
    MintGatewayProxyBeaconV1 internal _mintGatewayProxyBeacon;
    LockGatewayProxyBeaconV1 internal _lockGatewayProxyBeacon;
}

contract RenAssetFactory is Initializable, RenAssetFactoryState {
    function renAssetProxyBeacon() public view returns (RenAssetProxyBeaconV1) {
        return _renAssetProxyBeacon;
    }

    function mintGatewayProxyBeacon() public view returns (MintGatewayProxyBeaconV1) {
        return _mintGatewayProxyBeacon;
    }

    function lockGatewayProxyBeacon() public view returns (LockGatewayProxyBeaconV1) {
        return _lockGatewayProxyBeacon;
    }

    function __RenAssetFactory_init(
        address renAssetProxyBeacon_,
        address mintGatewayProxyBeacon_,
        address lockGatewayProxyBeacon_
    ) public initializer {
        _renAssetProxyBeacon = RenAssetProxyBeaconV1(renAssetProxyBeacon_);
        _mintGatewayProxyBeacon = MintGatewayProxyBeaconV1(mintGatewayProxyBeacon_);
        _lockGatewayProxyBeacon = LockGatewayProxyBeaconV1(lockGatewayProxyBeacon_);
    }

    function _deployRenAsset(
        uint256 chainId,
        string calldata asset,
        string memory name,
        string memory symbol,
        uint8 decimals,
        string memory version
    ) internal returns (IERC20) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__RenAssetinit(uint256,string,string,string,uint8)",
            chainId,
            version,
            name,
            symbol,
            decimals
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address renAsset = renAssetProxyBeacon().deployProxy(create2Salt, encodedParameters);

        return IERC20(renAsset);
    }

    function _deployMintGateway(
        string memory chainName,
        string calldata asset,
        address signatureVerifier,
        address token,
        string memory version
    ) internal returns (IMintGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__MintGateway_init(string,string,address,address)",
            chainName,
            asset,
            signatureVerifier,
            token
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address mintGateway = mintGatewayProxyBeacon().deployProxy(create2Salt, encodedParameters);

        Ownable(mintGateway).transferOwnership(msg.sender);

        return IMintGateway(mintGateway);
    }

    function _deployLockGateway(
        string memory chainName,
        string calldata asset,
        address signatureVerifier,
        address token,
        string memory version
    ) internal returns (ILockGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__LockGateway_init(string,string,address,address)",
            chainName,
            asset,
            signatureVerifier,
            token
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address lockGateway = lockGatewayProxyBeacon().deployProxy(create2Salt, encodedParameters);

        Ownable(lockGateway).transferOwnership(msg.sender);

        return ILockGateway(lockGateway);
    }
}
