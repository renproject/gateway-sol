// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {SignatureVerifier} from "./SignatureVerifier.sol";
import {ValidString} from "../../libraries/ValidString.sol";
import {RenVMHashes} from "./RenVMHashes.sol";

contract GatewayStateV3 {
    // Selector hash details.
    string public chain;
    string public asset;
    bytes32 public selectorHash;

    /// @notice Each signature can only be seen once.
    mapping(bytes32 => bool) public _status;

    /// @notice Each Gateway is tied to a specific asset.
    address public token;

    SignatureVerifier public signatureVerifier;

    address public previousGateway;

    uint256 internal eventNonce;

    uint256[43] private __gap;
}

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract GatewayStateManagerV3 is Initializable, OwnableUpgradeable, GatewayStateV3 {
    event LogChainUpdated(string _chain, bytes32 _selectorHash);
    event LogAssetUpdated(string _asset, bytes32 _selectorHash);
    event LogSignatureVerifierUpdated(SignatureVerifier indexed _newSignatureVerifier);
    event LogTokenUpdated(address indexed _newToken);
    event LogPreviousGatewayUpdated(address indexed _newPreviousGateway);

    function __GatewayStateManager_init(
        string calldata chain_,
        string calldata asset_,
        address signatureVerifier_,
        address token_
    ) public initializer {
        __Ownable_init();
        updateChain(chain_);
        updateAsset(asset_);
        updateSignatureVerifier(SignatureVerifier(signatureVerifier_));
        updateToken(token_);
    }

    // GOVERNANCE //////////////////////////////////////////////////////////////

    /// @notice Allow the owner to update the chain.
    ///
    /// @param nextChain_ The new chain.
    function updateChain(string calldata nextChain_) public onlyOwner {
        require(ValidString.isNotEmpty(nextChain_), "Gateway: chain can't be empty");
        require(ValidString.isAlphanumeric(nextChain_), "Gateway: symbol must be alphanumeric");

        chain = nextChain_;
        selectorHash = RenVMHashes.calculateSelectorHash(asset, chain);
        emit LogChainUpdated(chain, selectorHash);
    }

    /// @notice Allow the owner to update the asset.
    ///
    /// @param nextAsset_ The new asset.
    function updateAsset(string calldata nextAsset_) public onlyOwner {
        require(ValidString.isNotEmpty(nextAsset_), "Gateway: asset can't be empty");
        require(ValidString.isAlphanumeric(nextAsset_), "Gateway: symbol must be alphanumeric");

        asset = nextAsset_;
        selectorHash = RenVMHashes.calculateSelectorHash(asset, chain);
        emit LogAssetUpdated(asset, selectorHash);
    }

    /// @notice Allow the owner to update the signature verifier contract.
    ///
    /// @param nextSignatureVerifier_ The new verifier contract address.
    function updateSignatureVerifier(SignatureVerifier nextSignatureVerifier_) public onlyOwner {
        require(address(nextSignatureVerifier_) != address(0x0), "Gateway: invalid signature verifier");
        signatureVerifier = nextSignatureVerifier_;
        emit LogSignatureVerifierUpdated(nextSignatureVerifier_);
    }

    /// @notice Allow the owner to update the ERC20 token contract.
    ///
    /// @param nextToken_ The new ERC20 token contract's address.
    function updateToken(address nextToken_) public onlyOwner {
        require(address(nextToken_) != address(0x0), "Gateway: invalid token");
        token = nextToken_;
        emit LogTokenUpdated(nextToken_);
    }

    /// @notice Allow the owner to update the previous gateway used for
    /// backwards compatibility.
    ///
    /// @param nextPreviousGateway_ The new gateway contract's address.
    function updatePreviousGateway(address nextPreviousGateway_) public onlyOwner {
        require(address(nextPreviousGateway_) != address(0x0), "Gateway: invalid address");
        previousGateway = nextPreviousGateway_;
        emit LogPreviousGatewayUpdated(nextPreviousGateway_);
    }

    // PREVIOUS GATEWAY ////////////////////////////////////////////////////////

    modifier onlyPreviousGateway() {
        // If there's no previous gateway, the second require should also fail,
        // but this require will provide a more informative reason.
        require(previousGateway != address(0x0), "Gateway: no previous gateway");

        require(_msgSender() == previousGateway, "Gateway: not authorized");
        _;
    }

    function status(bytes32 hash_) public view returns (bool) {
        if (_status[hash_]) {
            return true;
        }

        if (previousGateway != address(0x0)) {
            return GatewayStateManagerV3(previousGateway)._status(hash_);
        }

        return false;
    }
}
