// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {RenAssetV2} from "../RenAsset/RenAsset.sol";
import {GatewayStateV3, GatewayStateManagerV3} from "./common/GatewayState.sol";
import {RenVMHashes} from "./common/RenVMHashes.sol";
import {IMintGateway} from "./interfaces/IMintGateway.sol";
import {CORRECT_SIGNATURE_RETURN_VALUE_} from "./RenVMSignatureVerifier.sol";

/// MintGateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract MintGatewayV3 is Initializable, OwnableUpgradeable, GatewayStateV3, GatewayStateManagerV3, IMintGateway {
    function __MintGateway_init(
        string calldata chain_,
        string calldata asset_,
        address signatureVerifier_,
        address token_
    ) external initializer {
        OwnableUpgradeable.__Ownable_init();
        GatewayStateManagerV3.__GatewayStateManager_init(chain_, asset_, signatureVerifier_, token_);
    }

    // Governance functions ////////////////////////////////////////////////////

    /// @notice Allow the owner to update the owner of the RenERC20 token.
    function transferTokenOwnership(address nextTokenOwner_) external onlyOwner {
        RenAssetV2(token()).transferOwnership(address(nextTokenOwner_));
    }

    // PUBLIC FUNCTIONS ////////////////////////////////////////////////////////

    /// @notice mint verifies a mint approval signature from RenVM and creates
    ///         tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param pHash (payload hash) The hash of the payload associated with the
    ///        mint.
    /// @param amount The amount of the token being minted, in its smallest
    ///        value. (e.g. satoshis for BTC).
    /// @param nHash (nonce hash) The hash of the nonce, amount and pHash.
    /// @param sig The signature of the hash of the following values:
    ///        (pHash, amount, msg.sender, nHash), signed by the mintAuthority.
    function mint(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes memory sig
    ) external override returns (uint256) {
        return _mint(pHash, amount, nHash, sig, _msgSender());
    }

    /// @notice burnWithPayload allows minted assets to be released to their
    ///         native chain, or to another chain as specified by the chain and
    ///         payload parameters.
    ///         WARNING: Burning with invalid parameters can cause the funds to
    ///         become unrecoverable.
    ///
    /// @param recipientAddress The address to which the locked assets will be
    ///        minted to. The address should be a plain-text address, without
    ///        decoding to bytes first.
    /// @param recipientChain The target chain to which the assets are being
    ///        moved to.
    /// @param recipientPayload An optional payload to be passed to the
    ///        recipient chain along with the address.
    /// @param amount The amount of the token being locked, in the asset's
    ///        smallest unit. (e.g. satoshis for BTC)
    function burnWithPayload(
        string memory recipientAddress,
        string memory recipientChain,
        bytes memory recipientPayload,
        uint256 amount
    ) external override returns (uint256) {
        return _burnWithPayload(recipientAddress, recipientChain, recipientPayload, amount, _msgSender());
    }

    /// @notice burn is a convenience function that is equivalent to calling
    ///         `burnWithPayload` with an empty payload and chain, releasing
    ///         the asset to the native chain.
    function burn(string memory recipient, uint256 amount) external virtual returns (uint256) {
        return _burnWithPayload(recipient, "", "", amount, _msgSender());
    }

    /// Same as `burn` with the recipient parameter being `bytes` instead of
    /// a `string`. For backwards compatibility with the MintGatewayV2.
    function burn(bytes memory recipient, uint256 amount) external virtual override returns (uint256) {
        return _burnWithPayload(string(recipient), "", "", amount, _msgSender());
    }

    function _mintFromPreviousGateway(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes memory sig,
        address caller
    ) external onlyPreviousGateway returns (uint256) {
        return _mint(pHash, amount, nHash, sig, caller);
    }

    function _burnFromPreviousGateway(
        bytes memory recipient,
        uint256 amount,
        address caller
    ) external onlyPreviousGateway returns (uint256) {
        return _burnWithPayload(string(recipient), "", "", amount, caller);
    }

    // INTERNAL FUNCTIONS //////////////////////////////////////////////////////

    function _mint(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes memory sig,
        address caller
    ) internal returns (uint256) {
        // Calculate the hash signed by RenVM. This binds the payload hash,
        // amount, caller and nonce hash to the signature.
        bytes32 sigHash = RenVMHashes.calculateSigHash(pHash, amount, selectorHash(), caller, nHash);

        // Check that the signature hasn't been redeemed.
        require(!status(sigHash) && !status(nHash), "MintGateway: signature already spent");

        // If the signature fails verification, throw an error.
        if (signatureVerifier().isValidSignature(sigHash, sig) != CORRECT_SIGNATURE_RETURN_VALUE_) {
            revert("MintGateway: invalid signature");
        }

        // Update the status for both the signature hash and the nHash.
        _status[sigHash] = true;
        _status[nHash] = true;

        // Mint the amount to the caller.
        RenAssetV2(token()).mint(caller, amount);

        // Emit mint log. For backwards compatiblity reasons, the sigHash is
        // cast to a uint256.
        emit LogMint(caller, amount, uint256(sigHash), nHash);

        return amount;
    }

    /// @notice burn destroys tokens after taking a fee for the `_feeRecipient`,
    ///         allowing the associated assets to be released on their native
    ///         chain.
    ///
    /// @param recipientAddress The address to which the locked assets will be
    ///        minted to. The address should be a plain-text address, without
    ///        decoding to bytes first.
    /// @param recipientChain The target chain to which the assets are being
    ///        moved to.
    /// @param recipientPayload An optional payload to be passed to the
    ///        recipient chain along with the address.
    /// @param amount The amount of the token being locked, in the asset's
    ///        smallest unit. (e.g. satoshis for BTC)
    function _burnWithPayload(
        string memory recipientAddress,
        string memory recipientChain,
        bytes memory recipientPayload,
        uint256 amount,
        address caller
    ) internal returns (uint256) {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(bytes(recipientAddress).length != 0, "MintGateway: to address is empty");

        // Burn the tokens. If the user doesn't have enough tokens, this will
        // throw.
        RenAssetV2(token()).burn(caller, amount);

        uint256 burnNonce = eventNonce();

        if (bytes(recipientChain).length > 0 || recipientPayload.length > 0) {
            emit LogBurnToChain(
                recipientAddress,
                recipientChain,
                recipientPayload,
                amount,
                burnNonce,
                recipientAddress,
                recipientChain
            );
        } else {
            emit LogBurn(bytes(recipientAddress), amount, burnNonce, bytes(recipientAddress));
        }

        _eventNonce = burnNonce + 1;

        return amount;
    }
}
