// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

interface ISignatureVerifier {
    function verifySignature(bytes32 _sigHash, bytes memory _sig) external view returns (bool);
}

contract SignatureVerifierStateV1 {
    address internal _mintAuthority;
    uint256[49] private __gap;
}

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract SignatureVerifierV1 is Initializable, OwnableUpgradeable, SignatureVerifierStateV1 {
    event LogMintAuthorityUpdated(address indexed _newMintAuthority);

    function __SignatureVerifier_init(address mintAuthority_) public initializer {
        __Ownable_init();
        updateMintAuthority(mintAuthority_);
    }

    function mintAuthority() public view returns (address) {
        return _mintAuthority;
    }

    // GOVERNANCE //////////////////////////////////////////////////////////////

    modifier onlyOwnerOrMintAuthority() {
        require(_msgSender() == owner() || _msgSender() == mintAuthority(), "SignatureVerifier: not authorized");
        _;
    }

    /// @notice Allow the owner or mint authority to update the mint authority.
    ///
    /// @param nextMintAuthority The new mint authority address.
    function updateMintAuthority(address nextMintAuthority) public onlyOwnerOrMintAuthority {
        require(nextMintAuthority != address(0), "SignatureVerifier: mintAuthority cannot be set to address zero");
        _mintAuthority = nextMintAuthority;
        emit LogMintAuthorityUpdated(_mintAuthority);
    }

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters.
    function verifySignature(bytes32 sigHash, bytes memory sig) public view returns (bool) {
        address mingAuthority_ = mintAuthority();
        require(mingAuthority_ != address(0x0), "SignatureVerifier: mintAuthority not initialized");
        return mingAuthority_ == ECDSA.recover(sigHash, sig);
    }
}

contract SignatureVerifierProxy is TransparentUpgradeableProxy {
    constructor(
        address logic,
        address admin,
        bytes memory data
    ) payable TransparentUpgradeableProxy(logic, admin, data) {}
}
