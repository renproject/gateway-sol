// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

abstract contract IMintGateway {
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

    function mint(
        bytes32 pHash,
        uint256 amount,
        bytes32 nHash,
        bytes memory sig
    ) public virtual returns (uint256);

    function burnWithPayload(
        string memory recipientAddress,
        string memory recipientChain,
        bytes memory recipientPayload,
        uint256 amount
    ) public virtual returns (uint256);

    function burn(bytes memory recipient, uint256 amount) public virtual returns (uint256);
}
