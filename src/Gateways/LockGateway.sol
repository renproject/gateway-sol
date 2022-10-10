// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {SafeTransferWithFeesUpgradeable} from "./common/SafeTransferWithFees.sol";
import {GatewayStateV4, GatewayStateManagerV4} from "./common/GatewayState.sol";
import {RenVMHashes} from "./common/RenVMHashes.sol";
import {ILockGateway} from "./interfaces/ILockGateway.sol";
import {CORRECT_SIGNATURE_RETURN_VALUE_} from "./RenVMSignatureVerifier.sol";
import {String} from "../libraries/String.sol";

/// LockGatewayV4 handles verifying lock and release requests. A mint authority
/// approves assets being released by providing a digital signature.
/// The balance of assets is assumed not to change without a transfer, so
/// rebasing assets and assets with a demurrage fee are not supported.
contract LockGatewayV4 is
    Initializable,
    ContextUpgradeable,
    GatewayStateV4,
    GatewayStateManagerV4,
    ILockGateway,
    IERC721ReceiverUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeTransferWithFeesUpgradeable for IERC20Upgradeable;

    string public constant NAME = "LockGateway";

    // If these parameters are changed, RenAssetFactory must be updated as well.
    function __LockGateway_init(
        string calldata asset_,
        address signatureVerifier_,
        address token_,
        bool isNFT_
    ) external initializer {
        __Context_init();
        __GatewayStateManager_init(asset_, signatureVerifier_, token_, isNFT_);
    }

    // Public functions ////////////////////////////////////////////////////////

    /// @notice Transfers tokens into custody by this contract so that they
    ///         can be minted on another chain.
    ///
    /// @param recipientAddress The address to which the locked assets will be
    ///        minted to. The address should be a plain-text address, without
    ///        decoding to bytes first.
    /// @param recipientChain The target chain to which the assets are being
    ///        moved to.
    /// @param recipientPayload An optional payload to be passed to the
    ///        recipient chain along with the address.
    /// @param amountOrTokenId The amount of the token being locked, in the
    ///        asset's smallest unit or tokenId if it is an NFT. (e.g. satoshis 
    ///        for BTC)
    function lock(
        string calldata recipientAddress,
        string calldata recipientChain,
        bytes calldata recipientPayload,
        uint256 amountOrTokenId
    ) external override returns (uint256) {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(String.isNotEmpty(recipientAddress), "LockGateway: to address is empty");

        // Lock the tokens. If the user doesn't have enough tokens, this will
        // throw. Note that some assets may transfer less than the provided
        // `amount`, due to transfer fees.
        uint256 transferredAmountOrTokenId = amountOrTokenId;
        if (_isNFT) {
            transferredAmountOrTokenId = amountOrTokenId;
            IERC721Upgradeable(getToken()).safeTransferFrom(
                _msgSender(),
                address(this),
                amountOrTokenId
            );
        } else {
            transferredAmountOrTokenId = IERC20Upgradeable(getToken()).safeTransferFromWithFees(
                _msgSender(),
                address(this),
                amountOrTokenId
            );
        }

        // Get the latest nonce (also known as lock reference).
        uint256 lockNonce = getEventNonce();

        emit LogLockToChain(
            recipientAddress,
            recipientChain,
            recipientPayload,
            transferredAmountOrTokenId,
            lockNonce,
            recipientAddress,
            recipientChain
        );

        _eventNonce = lockNonce + 1;

        return transferredAmountOrTokenId;
    }

    /// @notice release verifies a release approval signature from RenVM and
    ///         transfers the asset out of custody and to the recipient.
    ///
    /// @param pHash (payload hash) The hash of the payload associated with the
    ///        release.
    /// @param amountOrTokenId The amount of the token being released, in its
    ///        smallest value or the token id of the NFT.
    /// @param nHash (nonce hash) The hash of the nonce, amount and pHash.
    /// @param sig The signature of the hash of the following values:
    ///        (pHash, amount, recipient, nHash), signed by the mintAuthority.
    function release(
        bytes32 pHash,
        uint256 amountOrTokenId,
        bytes32 nHash,
        bytes calldata sig
    ) external override returns (uint256) {
        // The recipient must match the value signed by RenVM.
        address recipient = _msgSender();

        // Calculate the hash signed by RenVM. This binds the payload hash,
        // amountOrTokenId, recipient and nonce hash to the signature.
        bytes32 sigHash = RenVMHashes.calculateSigHash(pHash, amountOrTokenId, getSelectorHash(), recipient, nHash);

        // Check that the signature hasn't been redeemed.
        require(!status(sigHash), "LockGateway: signature already spent");

        // If the signature fails verification, throw an error.
        // `isValidSignature` must return an exact bytes4 value, to avoid
        // a contract mistakingly returning a truthy value without intending to.
        if (getSignatureVerifier().isValidSignature(sigHash, sig) != CORRECT_SIGNATURE_RETURN_VALUE_) {
            revert(
                string(
                    abi.encodePacked(
                        "LockGateway: invalid signature. phash: ",
                        StringsUpgradeable.toHexString(uint256(pHash), 32),
                        ", amountOrTokenId: ",
                        StringsUpgradeable.toString(amountOrTokenId),
                        ", shash",
                        StringsUpgradeable.toHexString(uint256(getSelectorHash()), 32),
                        ", msg.sender: ",
                        StringsUpgradeable.toHexString(uint160(recipient), 20),
                        ", nhash: ",
                        StringsUpgradeable.toHexString(uint256(nHash), 32)
                    )
                )
            );
        }

        // Update the status for both the signature hash and the nHash.
        _status[sigHash] = true;

        if (_isNFT) {
            // Release the nft to the recipient.
            IERC721Upgradeable(getToken()).safeTransferFrom(address(this), recipient, amountOrTokenId);
        } else {
            // Release the amountOrTokenId to the recipient.
            IERC20Upgradeable(getToken()).safeTransfer(recipient, amountOrTokenId);
        }

        // Emit a log with a unique identifier 'n'.
        emit LogRelease(recipient, amountOrTokenId, sigHash, nHash);

        return amountOrTokenId;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
