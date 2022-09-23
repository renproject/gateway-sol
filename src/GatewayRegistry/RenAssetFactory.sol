// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";
import {IMintGateway} from "../Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "../Gateways/interfaces/ILockGateway.sol";
import {RenERC20ProxyBeacon, RenERC721ProxyBeacon, MintGatewayProxyBeacon, LockGatewayProxyBeacon} from "./ProxyBeacon.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RenAssetFactoryStateV2 {
    RenERC20ProxyBeacon internal _renERC20ProxyBeacon;
    RenERC721ProxyBeacon internal _renERC721ProxyBeacon;
    MintGatewayProxyBeacon internal _mintGatewayProxyBeacon;
    LockGatewayProxyBeacon internal _lockGatewayProxyBeacon;
}

abstract contract RenAssetFactoryV2 is Initializable, ContextUpgradeable, RenAssetFactoryStateV2 {
    event RenAssetProxyDeployed(
        uint256 chainId,
        string asset,
        string name,
        string symbol,
        uint8 decimals,
        bool isNFT,
        string version
    );
    event MintGatewayProxyDeployed(string asset, address signatureVerifier, address token, bool isNFT, string version);
    event LockGatewayProxyDeployed(string asset, address signatureVerifier, address token, bool isNFT, string version);

    function getRenERC20ProxyBeacon() public view returns (RenERC20ProxyBeacon) {
        return _renERC20ProxyBeacon;
    }

    function getRenERC721ProxyBeacon() public view returns (RenERC721ProxyBeacon) {
        return _renERC721ProxyBeacon;
    }

    function getMintGatewayProxyBeacon() public view returns (MintGatewayProxyBeacon) {
        return _mintGatewayProxyBeacon;
    }

    function getLockGatewayProxyBeacon() public view returns (LockGatewayProxyBeacon) {
        return _lockGatewayProxyBeacon;
    }

    function __RenAssetFactory_init(
        address renERC20ProxyBeacon_,
        address renERC721ProxyBeacon_,
        address mintGatewayProxyBeacon_,
        address lockGatewayProxyBeacon_
    ) public onlyInitializing {
        __Context_init();
        _renERC20ProxyBeacon = RenERC20ProxyBeacon(renERC20ProxyBeacon_);
        _renERC721ProxyBeacon = RenERC721ProxyBeacon(renERC721ProxyBeacon_);
        _mintGatewayProxyBeacon = MintGatewayProxyBeacon(mintGatewayProxyBeacon_);
        _lockGatewayProxyBeacon = LockGatewayProxyBeacon(lockGatewayProxyBeacon_);
    }

    function _deployRenERC20(
        uint256 chainId,
        string calldata asset,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        string calldata version
    ) internal returns (IERC20) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__RenERC20_init(uint256,string,string,string,uint8,address)",
            chainId,
            version,
            name,
            symbol,
            decimals,
            // Owner will be transferred to gateway
            address(this)
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address renAsset = getRenERC20ProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit RenAssetProxyDeployed(chainId, asset, name, symbol, decimals, false, version);

        return IERC20(renAsset);
    }

    function _deployRenERC721(
        uint256 chainId,
        string calldata asset,
        string calldata name,
        string calldata symbol,
        string calldata version
    ) internal returns (IERC721) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__RenERC721_init(uint256,string,string,string,address)",
            chainId,
            version,
            name,
            symbol,
            // Owner will be transferred to gateway
            address(this)
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address renAsset = getRenERC721ProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit RenAssetProxyDeployed(chainId, asset, name, symbol, 1, true, version);

        return IERC721(renAsset);
    }

    function _deployMintGateway(
        string calldata asset,
        address signatureVerifier,
        address token,
        bool isNFT,
        string calldata version
    ) internal returns (IMintGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__MintGateway_init(string,address,address,bool)",
            asset,
            signatureVerifier,
            token,
            isNFT
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address mintGateway = getMintGatewayProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit MintGatewayProxyDeployed(asset, signatureVerifier, token, isNFT, version);

        return IMintGateway(mintGateway);
    }

    function _deployLockGateway(
        string calldata asset,
        address signatureVerifier,
        address token,
        bool isNFT,
        string calldata version
    ) internal returns (ILockGateway) {
        bytes memory encodedParameters = abi.encodeWithSignature(
            "__LockGateway_init(string,address,address,bool)",
            asset,
            signatureVerifier,
            token,
            isNFT
        );

        bytes32 create2Salt = keccak256(abi.encodePacked(asset, version));

        address lockGateway = getLockGatewayProxyBeacon().deployProxy(create2Salt, encodedParameters);

        emit LockGatewayProxyDeployed(asset, signatureVerifier, token, isNFT, version);

        return ILockGateway(lockGateway);
    }
}
