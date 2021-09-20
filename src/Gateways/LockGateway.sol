// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {RenAssetV2} from "../RenAsset/RenAsset.sol";
import {SafeTransferWithFees} from "./common/SafeTransferWithFees.sol";
import {GatewayStateV3, GatewayStateManagerV3} from "./common/GatewayState.sol";
import {RenVMHashes} from "./common/RenVMHashes.sol";

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract LockGatewayV3 is Initializable, OwnableUpgradeable, GatewayStateV3, GatewayStateManagerV3 {
    using SafeERC20 for IERC20;
    using SafeTransferWithFees for IERC20;

    event LogRelease(address indexed recipient, uint256 amount, bytes32 indexed sigHash, bytes32 indexed nHash);

    event LogLockToChain(
        string recipientAddress,
        string recipientChain,
        bytes recipientPayload,
        uint256 amount,
        uint256 indexed lockNonce,
        // Indexed versions of previous parameters.
        string indexed recipientAddressIndexed,
        string indexed recipientChainIndexed
    );

    function __LockGateway_init(
        string calldata chain_,
        string calldata asset_,
        address signatureVerifier_,
        address token_
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        GatewayStateManagerV3.__GatewayStateManager_init(chain_, asset_, signatureVerifier_, token_);
    }

    // Public functions ////////////////////////////////////////////////////////

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
    function lock(
        string memory recipientAddress,
        string memory recipientChain,
        bytes memory recipientPayload,
        uint256 amount
    ) public returns (uint256) {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(bytes(recipientAddress).length != 0, "LockGateway: to address is empty");

        // Burn the tokens. If the user doesn't have enough tokens, this will
        // throw.
        uint256 transferredAmount = IERC20(token()).safeTransferFromWithFees(msg.sender, address(this), amount);

        uint256 lockNonce = eventNonce();

        emit LogLockToChain(
            recipientAddress,
            recipientChain,
            recipientPayload,
            transferredAmount,
            lockNonce,
            recipientAddress,
            recipientChain
        );

        _eventNonce = lockNonce + 1;

        return amount;
    }

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
    function release(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes memory sig
    ) public returns (uint256) {
        // Calculate the hash signed by RenVM. This binds the payload hash,
        // amount, msg.sender and nonce hash to the signature.
        bytes32 sigHash = RenVMHashes.calculateSigHash(pHash, amount, selectorHash(), msg.sender, nHash);

        // Check that the signature hasn't been redeemed.
        require(status(sigHash) == false && status(nHash) == false, "LockGateway: signature already spent");

        // If the signature fails verification, throw an error.
        if (!signatureVerifier().verifySignature(sigHash, sig)) {
            revert("LockGateway: invalid signature");
        }

        // Update the status for both the signature hash and the nHash.
        _status[sigHash] = true;
        _status[nHash] = true;

        // Mint the amount to the msg.sender.
        IERC20(token()).safeTransfer(msg.sender, amount);

        // Emit a log with a unique identifier 'n'.
        emit LogRelease(msg.sender, amount, sigHash, nHash);

        return amount;
    }
}
