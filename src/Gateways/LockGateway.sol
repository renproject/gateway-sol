// SPDX-License-Identifier: GPL-3.0-only

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

    event LogLock(
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
        address token
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        GatewayStateManagerV3.__GatewayStateManager_init(chain_, asset_, signatureVerifier_, token);
    }

    // Public functions ////////////////////////////////////////////////////////

    function nextN() public view returns (uint256) {
        return GatewayStateV3.eventNonce;
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
    function lock(
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_
    ) public returns (uint256) {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(bytes(recipientAddress_).length != 0, "LockGateway: to address is empty");

        // Burn the tokens. If the user doesn't have enough tokens, this will
        // throw.
        uint256 amountActual = IERC20(GatewayStateV3.token).safeTransferFromWithFees(
            msg.sender,
            address(this),
            amount_
        );

        uint256 lockNonce = GatewayStateV3.eventNonce;

        emit LogLock(
            recipientAddress_,
            recipientChain_,
            recipientPayload_,
            amountActual,
            lockNonce,
            recipientAddress_,
            recipientChain_
        );

        GatewayStateV3.eventNonce = lockNonce + 1;

        return amount_;
    }

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
    function release(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 nHash_,
        bytes memory sig_
    ) public returns (uint256) {
        // Calculate the hash signed by RenVM. This binds the payload hash,
        // amount, msg.sender and nonce hash to the signature.
        bytes32 sigHash = RenVMHashes.calculateSigHash(
            pHash_,
            amount_,
            GatewayStateV3.selectorHash,
            msg.sender,
            nHash_
        );

        // Check that the signature hasn't been redeemed.
        require(status(sigHash) == false && status(nHash_) == false, "LockGateway: signature already spent");

        // If the signature fails verification, throw an error.
        if (!GatewayStateV3.signatureVerifier.verifySignature(sigHash, sig_)) {
            revert("LockGateway: invalid signature");
        }

        // Update the status for both the signature hash and the nHash.
        _status[sigHash] = true;
        _status[nHash_] = true;

        // Mint the amount to the msg.sender.
        IERC20(GatewayStateV3.token).safeTransfer(msg.sender, amount_);

        // Emit a log with a unique identifier 'n'.
        emit LogRelease(msg.sender, amount_, sigHash, nHash_);

        return amount_;
    }
}
