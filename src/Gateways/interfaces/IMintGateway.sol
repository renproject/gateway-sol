// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

abstract contract IMintGateway {
    // For backwards compatiblity reasons, the sigHash is cast to a uint256.
    event LogMint(address indexed to_, uint256 amount_, uint256 indexed _sigHash, bytes32 indexed _nHash);

    // For backwards compatibility, `_to` is bytes instead of a string, and the third parameter is unused.
    event LogBurn(bytes _to, uint256 _amount, uint256 indexed _gap, bytes indexed _indexedTo);
    event LogBurnWithPayload(
        string recipientAddress_,
        string recipientChain_,
        bytes recipientPayload_,
        uint256 amount_,
        // Indexed versions of previous parameters.
        string indexed recipientAddressIndexed_,
        string indexed recipientChainIndexed_
    );

    function mint(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 nHash_,
        bytes memory sig_
    ) public virtual returns (uint256);

    function burnWithPayload(
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_
    ) public virtual returns (uint256);

    function burn(bytes memory recipient_, uint256 amount_) public virtual returns (uint256);
}
