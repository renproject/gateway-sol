// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Legacy_Claimable.sol";
import "./interfaces/Legacy_IGateway.sol";
import "./Legacy_CanReclaimTokens.sol";
import "./Legacy_MintGatewayV1.sol";
import "./Legacy_MintGatewayV2.sol";

interface NextGateway {
    function _mintFromPreviousGateway(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes calldata sig,
        address caller
    ) external returns (uint256);

    function _burnFromPreviousGateway(
        string calldata recipientAddress,
        string calldata recipientChain,
        bytes calldata recipientPayload,
        uint256 amount,
        address caller
    ) external returns (uint256);

    function verifySignature(bytes32 _sigHash, bytes calldata _sig) external view returns (bool);

    function hashForSignature(
        bytes32 _pHash,
        uint256 _amount,
        address _to,
        bytes32 _nHash
    ) external view returns (bytes32);
}

contract Legacy_MintGatewayForwarderState is Legacy_MintGatewayStateV1, Legacy_MintGatewayStateV2 {
    // Gap to replace `_legacy_mintAuthority`.
    address public __gap;

    address public nextGateway;
}

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract MintGatewayForwarder is
    Initializable,
    Legacy_Claimable,
    Legacy_CanReclaimTokens,
    Legacy_IGateway,
    Legacy_MintGatewayStateV1,
    Legacy_MintGatewayStateV2,
    Legacy_MintGatewayForwarderState
{
    event LogNextGatewayUpdated(address indexed _newNextGateway);
    event LogMintForwarded(bytes32 _pHash, uint256 _amountUnderlying, bytes32 _nHash, address minter);
    event LogBurnForwarded(bytes _to, uint256 _amount, address burner);

    function initialize(
        Legacy_RenERC20LogicV1 _token,
        address,
        address,
        uint16,
        uint16,
        uint256
    ) public initializer {
        Legacy_Claimable.initialize(msg.sender);
        Legacy_CanReclaimTokens.initialize(msg.sender);
        token = _token;
    }

    // Allow the owner to update the next gateway.
    function updateNextGateway(address newNextGateway) public onlyOwner {
        nextGateway = newNextGateway;

        emit LogNextGatewayUpdated(newNextGateway);
    }

    // Public functions ////////////////////////////////////////////////////////

    /// @notice mint verifies a mint approval signature from RenVM and creates
    ///         tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param _pHash (payload hash) The hash of the payload associated with the
    ///        mint.
    /// @param _amountUnderlying The amount of the token being minted, in its smallest
    ///        value. (e.g. satoshis for BTC).
    /// @param _nHash (nonce hash) The hash of the nonce, amount and pHash.
    /// @param _sig The signature of the hash of the following values:
    ///        (pHash, amount, msg.sender, nHash), signed by the mintAuthority.
    function mint(
        bytes32 _pHash,
        uint256 _amountUnderlying,
        bytes32 _nHash,
        bytes memory _sig
    ) public returns (uint256) {
        emit LogMintForwarded(_pHash, _amountUnderlying, _nHash, msg.sender);
        return NextGateway(nextGateway)._mintFromPreviousGateway(_pHash, _amountUnderlying, _nHash, _sig, msg.sender);
    }

    /// @notice burn destroys tokens after taking a fee for the `_feeRecipient`,
    ///         allowing the associated assets to be released on their native
    ///         chain.
    ///
    /// @param _to The address to receive the un-bridged asset. The format of
    ///        this address should be of the destination chain.
    ///        For example, when burning to Bitcoin, _to should be a
    ///        Bitcoin address.
    /// @param _amount The amount of the token being burnt, in its
    ///        smallest value. (e.g. satoshis for BTC)
    function burn(bytes memory _to, uint256 _amount) public returns (uint256) {
        emit LogBurnForwarded(_to, _amount, msg.sender);
        return NextGateway(nextGateway)._burnFromPreviousGateway(string(_to), "", "", _amount, msg.sender);
    }

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters.
    function verifySignature(bytes32 _sigHash, bytes memory _sig) public view returns (bool) {
        return NextGateway(nextGateway).verifySignature(_sigHash, _sig);
    }

    /// @notice hashForSignature hashes the parameters so that they can be
    /// signed.
    function hashForSignature(
        bytes32 _pHash,
        uint256 _amount,
        address _to,
        bytes32 _nHash
    ) public view returns (bytes32) {
        return NextGateway(nextGateway).hashForSignature(_pHash, _amount, _to, _nHash);
    }
}
