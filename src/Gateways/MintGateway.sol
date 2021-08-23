// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {RenAssetV1} from "../RenAsset/RenAsset.sol";
import {GatewayStateV1, GatewayStateManagerV1} from "./common/GatewayState.sol";
import {RenVMHashes} from "./common/RenVMHashes.sol";

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract MintGatewayV3 is Initializable, OwnableUpgradeable, GatewayStateV1, GatewayStateManagerV1 {
    // For backwards compatiblity reasons, the sigHash is cast to a uint256.
    event LogMint(address indexed to, uint256 amount, uint256 indexed sigHash, bytes32 indexed nHash);

    // For backwards compatibility, `to` is bytes instead of a string, and the third parameter is unused.
    event LogBurn(bytes to, uint256 amount, uint256 indexed gap, bytes indexed indexedTo);
    event LogBurnWithPayload(
        string recipientAddress,
        string recipientChain,
        bytes recipientPayload,
        uint256 amount,
        // Indexed versions of previous parameters.
        string indexed recipientAddressIndexed,
        string indexed recipientChainIndexed
    );

    function __MintGateway_init(
        string calldata chain_,
        string calldata asset_,
        address signatureVerifier_,
        address token
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        GatewayStateManagerV1.__GatewayStateManager_init(chain_, asset_, signatureVerifier_, token);
    }

    // Governance functions ////////////////////////////////////////////////////

    /// @notice Allow the owner to update the owner of the RenERC20 token.
    function transferTokenOwnership(address nextTokenOwner_) public onlyOwner {
        RenAssetV1(GatewayStateV1.token).transferOwnership(address(nextTokenOwner_));
    }

    // PUBLIC FUNCTIONS ////////////////////////////////////////////////////////

    /// @notice mint verifies a mint approval signature from RenVM and creates
    ///         tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param pHash_ (payload hash) The hash of the payload associated with the
    ///        mint.
    /// @param amount_ The amount of the token being minted, in its smallest
    ///        value. (e.g. satoshis for BTC).
    /// @param nHash_ (nonce hash) The hash of the nonce, amount and pHash.
    /// @param sig_ The signature of the hash of the following values:
    ///        (pHash, amount, msg.sender, nHash), signed by the mintAuthority.
    function mint(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 nHash_,
        bytes memory sig_
    ) public returns (uint256) {
        return _mint(pHash_, amount_, nHash_, sig_, _msgSender());
    }

    /// @notice burn destroys tokens after taking a fee for the `_feeRecipient`,
    ///         allowing the associated assets to be released on their native
    ///         chain.
    ///
    /// @param recipientAddress_ The address to which the locked assets will be
    ///        minted to. The address should be a plain-text address, without
    ///        decoding to bytes first.
    /// @param recipientChain_ The target chain to which the assets are being
    ///        moved to.
    /// @param recipientPayload_ An optional payload to be passed to the
    ///        recipient chain along with the address.
    /// @param amount_ The amount of the token being locked, in the asset's
    ///        smallest unit. (e.g. satoshis for BTC)
    function burnWithPayload(
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_
    ) public returns (uint256) {
        return _burnWithPayload(recipientAddress_, recipientChain_, recipientPayload_, amount_, _msgSender());
    }

    // For backwards compatibility,
    function burn(bytes memory recipient_, uint256 amount_) public virtual returns (uint256) {
        return _burnWithPayload(string(recipient_), "", "", amount_, _msgSender());
    }

    function _mintFromPreviousGateway(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 nHash_,
        bytes memory sig_,
        address caller_
    ) public onlyPreviousGateway returns (uint256) {
        return _mint(pHash_, amount_, nHash_, sig_, caller_);
    }

    function _burnFromPreviousGateway(
        bytes memory recipient_,
        uint256 amount_,
        address caller_
    ) public onlyPreviousGateway returns (uint256) {
        return _burnWithPayload(string(recipient_), "", "", amount_, caller_);
    }

    // INTERNAL FUNCTIONS //////////////////////////////////////////////////////

    function _mint(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 nHash_,
        bytes memory sig_,
        address caller_
    ) internal returns (uint256) {
        // Calculate the hash signed by RenVM. This binds the payload hash,
        // amount, caller and nonce hash to the signature.
        bytes32 sigHash = RenVMHashes.calculateSigHash(pHash_, amount_, GatewayStateV1.selectorHash, caller_, nHash_);

        // Check that the signature hasn't been redeemed.
        require(status(sigHash) == false && status(nHash_) == false, "MintGateway: signature already spent");

        // If the signature fails verification, throw an error.
        if (!GatewayStateV1.signatureVerifier.verifySignature(sigHash, sig_)) {
            revert("MintGateway: invalid signature");
        }

        // Update the status for both the signature hash and the nHash.
        _status[sigHash] = true;
        _status[nHash_] = true;

        // Mint the amount to the caller.
        RenAssetV1(GatewayStateV1.token).mint(caller_, amount_);

        // Emit mint log. For backwards compatiblity reasons, the sigHash is
        // cast to a uint256.
        emit LogMint(caller_, amount_, uint256(sigHash), nHash_);

        return amount_;
    }

    /// @notice burn destroys tokens after taking a fee for the `_feeRecipient`,
    ///         allowing the associated assets to be released on their native
    ///         chain.
    ///
    /// @param recipientAddress_ The address to which the locked assets will be
    ///        minted to. The address should be a plain-text address, without
    ///        decoding to bytes first.
    /// @param recipientChain_ The target chain to which the assets are being
    ///        moved to.
    /// @param recipientPayload_ An optional payload to be passed to the
    ///        recipient chain along with the address.
    /// @param amount_ The amount of the token being locked, in the asset's
    ///        smallest unit. (e.g. satoshis for BTC)
    function _burnWithPayload(
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_,
        address caller_
    ) internal returns (uint256) {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(bytes(recipientAddress_).length != 0, "MintGateway: to address is empty");

        // Burn the tokens. If the user doesn't have enough tokens, this will
        // throw.
        RenAssetV1(GatewayStateV1.token).burn(caller_, amount_);

        if (bytes(recipientChain_).length > 0 || recipientPayload_.length > 0) {
            emit LogBurnWithPayload(
                recipientAddress_,
                recipientChain_,
                recipientPayload_,
                amount_,
                recipientAddress_,
                recipientChain_
            );
        } else {
            emit LogBurn(bytes(recipientAddress_), amount_, 0, bytes(recipientAddress_));
        }

        return amount_;
    }
}
