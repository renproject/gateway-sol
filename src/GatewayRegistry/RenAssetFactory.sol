// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
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

abstract contract RenAssetFactory is Initializable, ContextUpgradeable, RenAssetFactoryState {
    event RenAssetProxyDeployed(
        uint256 chainId,
        string asset,
        string name,
        string symbol,
        uint8 decimals,
        string version
    );
    event MintGatewayProxyDeployed(
        string chainName,
        string asset,
        address signatureVerifier,
        address token,
        string version
    );
    event LockGatewayProxyDeployed(
        string chainName,
        string asset,
        address signatureVerifier,
        address token,
        string version
    );

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
        __Context_init();
        _renAssetProxyBeacon = RenAssetProxyBeaconV1(renAssetProxyBeacon_);
        _mintGatewayProxyBeacon = MintGatewayProxyBeaconV1(mintGatewayProxyBeacon_);
        _lockGatewayProxyBeacon = LockGatewayProxyBeaconV1(lockGatewayProxyBeacon_);
    }

    function _deployRenAsset(
        uint256 chainId,
        string calldata asset,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        string calldata version
    ) internal returns (IERC20) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__RenAsset_init(uint256,string,string,string,uint8,address)",
            chainId,
            version,
            name,
            symbol,
            decimals,
            address(this)
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address renAsset = renAssetProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit RenAssetProxyDeployed(chainId, asset, name, symbol, decimals, version);

        return IERC20(renAsset);
    }

    function _deployMintGateway(
        string memory chainName,
        string calldata asset,
        address signatureVerifier,
        address token,
        string calldata version
    ) internal returns (IMintGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__MintGateway_init(string,string,address,address,address)",
            chainName,
            asset,
            signatureVerifier,
            token,
            _msgSender()
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address mintGateway = mintGatewayProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit MintGatewayProxyDeployed(chainName, asset, signatureVerifier, token, version);

        return IMintGateway(mintGateway);
    }

    function _deployLockGateway(
        string memory chainName,
        string calldata asset,
        address signatureVerifier,
        address token,
        string calldata version
    ) internal returns (ILockGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__LockGateway_init(string,string,address,address,address)",
            chainName,
            asset,
            signatureVerifier,
            token,
            _msgSender()
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address lockGateway = lockGatewayProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit LockGatewayProxyDeployed(chainName, asset, signatureVerifier, token, version);

        return ILockGateway(lockGateway);
    }
}
