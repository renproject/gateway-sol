// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

abstract contract ILockGateway {
    event LogRelease(address indexed recipient_, uint256 amount_, bytes32 indexed sigHash_, bytes32 indexed nHash_);
    event LogLock(
        string recipientAddress_,
        string recipientChain_,
        bytes recipientPayload_,
        uint256 amount_,
        // Indexed versions of previous parameters.
        string indexed recipientAddressIndexed_,
        string indexed recipientChainIndexed_
    );

    function lock(
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_
    ) public virtual returns (uint256);

    function release(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 nHash_,
        bytes memory sig_
    ) public virtual returns (uint256);
}
