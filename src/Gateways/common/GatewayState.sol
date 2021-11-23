// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IRenVMSignatureVerifier} from "../RenVMSignatureVerifier.sol";
import {String} from "../../libraries/String.sol";
import {RenVMHashes} from "./RenVMHashes.sol";

abstract contract GatewayStateV3 {
    // Selector hash details.
    string internal _chain;
    string internal _asset;
    bytes32 internal _selectorHash;

    /// @notice Each signature can only be seen once.
    mapping(bytes32 => bool) internal _status;

    /// @notice Each Gateway is tied to a specific asset.
    address internal _token;

    IRenVMSignatureVerifier internal _signatureVerifier;

    address internal _previousGateway;

    uint256 internal _eventNonce;

    // Leave a gap so that storage values added in future upgrages don't corrupt
    // the storage of contracts that inherit from this contract.
    uint256[42] private __gap;
}

abstract contract GatewayStateManagerV3 is Initializable, OwnableUpgradeable, GatewayStateV3 {
    event LogChainUpdated(string _chain, bytes32 indexed _selectorHash);
    event LogAssetUpdated(string _asset, bytes32 indexed _selectorHash);
    event LogSignatureVerifierUpdated(address indexed _newSignatureVerifier);
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
        updateSignatureVerifier(signatureVerifier_);
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
        require(_selectorHash != bytes32(0x0), "Gateway: not initialized");
        return _selectorHash;
    }

    function token() public view returns (address) {
        return _token;
    }

    function signatureVerifier() public view returns (IRenVMSignatureVerifier) {
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
        require(String.isValidString(nextChain), "Gateway: invalid chain");

        _chain = nextChain;

        bytes32 newSelectorHash = RenVMHashes.calculateSelectorHash(asset(), nextChain);
        _selectorHash = newSelectorHash;
        emit LogChainUpdated(nextChain, newSelectorHash);
    }

    /// @notice Allow the owner to update the asset.
    ///
    /// @param nextAsset The new asset.
    function updateAsset(string calldata nextAsset) public onlyOwner {
        require(String.isValidString(nextAsset), "Gateway: invalid asset");

        _asset = nextAsset;

        bytes32 newSelectorHash = RenVMHashes.calculateSelectorHash(nextAsset, chain());
        _selectorHash = newSelectorHash;
        emit LogAssetUpdated(nextAsset, newSelectorHash);
    }

    /// @notice Allow the owner to update the signature verifier contract.
    ///
    /// @param nextSignatureVerifier The new verifier contract address.
    function updateSignatureVerifier(address nextSignatureVerifier) public onlyOwner {
        require(address(nextSignatureVerifier) != address(0x0), "Gateway: invalid signature verifier");
        _signatureVerifier = IRenVMSignatureVerifier(nextSignatureVerifier);
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
    function updatePreviousGateway(address nextPreviousGateway) external onlyOwner {
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
