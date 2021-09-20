// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {ISignatureVerifier} from "./SignatureVerifier.sol";
import {ValidString} from "../../libraries/ValidString.sol";
import {RenVMHashes} from "./RenVMHashes.sol";

contract GatewayStateV3 {
    // Selector hash details.
    string internal _chain;
    string internal _asset;
    bytes32 internal _selectorHash;

    /// @notice Each signature can only be seen once.
    mapping(bytes32 => bool) internal _status;

    /// @notice Each Gateway is tied to a specific asset.
    address internal _token;

    ISignatureVerifier internal _signatureVerifier;

    address internal _previousGateway;

    uint256 internal _eventNonce;

    uint256[43] private __gap;
}

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract GatewayStateManagerV3 is Initializable, OwnableUpgradeable, GatewayStateV3 {
    event LogChainUpdated(string _chain, bytes32 _selectorHash);
    event LogAssetUpdated(string _asset, bytes32 _selectorHash);
    event LogSignatureVerifierUpdated(ISignatureVerifier indexed _newSignatureVerifier);
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
        updateSignatureVerifier(ISignatureVerifier(signatureVerifier_));
        updateToken(token_);
    }

    // GETTERS /////////////////////////////////////////////////////////////////

    function chain() public view returns (string memory) {
        return _chain;
    }

    function asset() public view returns (string memory) {
        return _asset;
    }

    function selectorHash() public view returns (bytes32) {
        return _selectorHash;
    }

    function token() public view returns (address) {
        return _token;
    }

    function signatureVerifier() public view returns (ISignatureVerifier) {
        return _signatureVerifier;
    }

    function previousGateway() public view returns (address) {
        return _previousGateway;
    }

    function eventNonce() public view returns (uint256) {
        return _eventNonce;
    }

    // GOVERNANCE //////////////////////////////////////////////////////////////

    /// @notice Allow the owner to update the chain.
    ///
    /// @param nextChain The new chain.
    function updateChain(string calldata nextChain) public onlyOwner {
        require(ValidString.isNotEmpty(nextChain), "Gateway: chain can't be empty");
        require(ValidString.isAlphanumeric(nextChain), "Gateway: symbol must be alphanumeric");

        _chain = nextChain;

        bytes32 newSelectorHash = RenVMHashes.calculateSelectorHash(asset(), nextChain);
        _selectorHash = newSelectorHash;
        emit LogChainUpdated(nextChain, newSelectorHash);
    }

    /// @notice Allow the owner to update the asset.
    ///
    /// @param nextAsset The new asset.
    function updateAsset(string calldata nextAsset) public onlyOwner {
        require(ValidString.isNotEmpty(nextAsset), "Gateway: asset can't be empty");
        require(ValidString.isAlphanumeric(nextAsset), "Gateway: symbol must be alphanumeric");

        _asset = nextAsset;

        bytes32 newSelectorHash = RenVMHashes.calculateSelectorHash(nextAsset, chain());
        _selectorHash = newSelectorHash;
        emit LogAssetUpdated(nextAsset, newSelectorHash);
    }

    /// @notice Allow the owner to update the signature verifier contract.
    ///
    /// @param nextSignatureVerifier The new verifier contract address.
    function updateSignatureVerifier(ISignatureVerifier nextSignatureVerifier) public onlyOwner {
        require(address(nextSignatureVerifier) != address(0x0), "Gateway: invalid signature verifier");
        _signatureVerifier = nextSignatureVerifier;
        emit LogSignatureVerifierUpdated(nextSignatureVerifier);
    }

    /// @notice Allow the owner to update the ERC20 token contract.
    ///
    /// @param nextToken The new ERC20 token contract's address.
    function updateToken(address nextToken) public onlyOwner {
        require(address(nextToken) != address(0x0), "Gateway: invalid token");
        _token = nextToken;
        emit LogTokenUpdated(nextToken);
    }

    /// @notice Allow the owner to update the previous gateway used for
    /// backwards compatibility.
    ///
    /// @param nextPreviousGateway The new gateway contract's address.
    function updatePreviousGateway(address nextPreviousGateway) public onlyOwner {
        require(address(nextPreviousGateway) != address(0x0), "Gateway: invalid address");
        _previousGateway = nextPreviousGateway;
        emit LogPreviousGatewayUpdated(nextPreviousGateway);
    }

    // PREVIOUS GATEWAY ////////////////////////////////////////////////////////

    modifier onlyPreviousGateway() {
        address previousGateway_ = previousGateway();

        // If there's no previous gateway, the second require should also fail,
        // but this require will provide a more informative reason.
        require(previousGateway_ != address(0x0), "Gateway: no previous gateway");

        require(_msgSender() == previousGateway_, "Gateway: not authorized");
        _;
    }

    function status(bytes32 hash) public view returns (bool) {
        if (_status[hash]) {
            return true;
        }

        address previousGateway_ = previousGateway();
        if (previousGateway_ != address(0x0)) {
            return GatewayStateManagerV3(previousGateway_).status(hash);
        }

        return false;
    }
}
