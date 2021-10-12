// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

abstract contract ILockGateway {
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

    function lock(
        string memory recipientAddress,
        string memory recipientChain,
        bytes memory recipientPayload,
        uint256 amount
    ) external virtual returns (uint256);

    function release(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes memory sig
    ) external virtual returns (uint256);
}
