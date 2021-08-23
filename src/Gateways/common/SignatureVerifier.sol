// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SignatureVerifierStateV1 {
    address public mintAuthority;
    uint256[49] private __gap;
}

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract SignatureVerifier is Initializable, OwnableUpgradeable, SignatureVerifierStateV1 {
    event LogMintAuthorityUpdated(address indexed _newMintAuthority);

    function __SignatureVerifier_init(address mintAuthority_) public initializer {
        __Ownable_init();
        updateMintAuthority(mintAuthority_);
    }

    // GOVERNANCE //////////////////////////////////////////////////////////////

    modifier onlyOwnerOrMintAuthority() {
        require(_msgSender() == owner() || _msgSender() == mintAuthority, "SignatureVerifier: not authorized");
        _;
    }

    /// @notice Allow the owner or mint authority to update the mint authority.
    ///
    /// @param nextMintAuthority_ The new mint authority address.
    function updateMintAuthority(address nextMintAuthority_) public onlyOwnerOrMintAuthority {
        require(nextMintAuthority_ != address(0), "SignatureVerifier: mintAuthority cannot be set to address zero");
        mintAuthority = nextMintAuthority_;
        emit LogMintAuthorityUpdated(mintAuthority);
    }

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters.
    function verifySignature(bytes32 _sigHash, bytes memory _sig) public view returns (bool) {
        require(mintAuthority != address(0x0), "SignatureVerifier: mintAuthority not initialized");
        return mintAuthority == ECDSA.recover(_sigHash, _sig);
    }
}
