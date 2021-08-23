// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

library RenVMHashes {
    /// @notice calculateSelectorHash calculates and hashes the selector hash,
    ///         which is formatted as `ASSET/toCHAIN`.
    function calculateSelectorHash(string memory assetSymbol_, string memory chain_) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(assetSymbol_, "/to", chain_));
    }

    /// @notice calculateSigHash hashes the parameters to reconstruct the data
    ///         signed by RenVM.
    function calculateSigHash(
        bytes32 pHash_,
        uint256 amount_,
        bytes32 selectorHash_,
        address to_,
        bytes32 nHash_
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(pHash_, amount_, selectorHash_, to_, nHash_));
    }
}
