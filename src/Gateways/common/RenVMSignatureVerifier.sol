// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/* solium-disable-next-line no-empty-blocks */
interface IRenVMSignatureVerifier is IERC1271 {

}

contract RenVMSignatureVerifierStateV1 {
    address internal _mintAuthority;
    uint256[49] private __gap;
}

// ERC-1271 uses 4-byte value instead of a boolean so that if a bug causes
// another function to be called (e.g. by proxy misconfiguration or fallbacks),
// a truthy value would not be interpreted as a successful check.
// See https://github.com/ethereum/EIPs/issues/1271#issuecomment-442328339.
bytes4 constant CORRECT_SIGNATURE_RETURN_VALUE_ = 0x1626ba7e;

contract RenVMSignatureVerifierV1 is Initializable, OwnableUpgradeable, RenVMSignatureVerifierStateV1, IERC1271 {
    event LogMintAuthorityUpdated(address indexed _newMintAuthority);

    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 public constant CORRECT_SIGNATURE_RETURN_VALUE = 0x1626ba7e; // CORRECT_SIGNATURE_RETURN_VALUE_
    bytes4 public constant INCORRECT_SIGNATURE_RETURN_VALUE = 0x000000;

    function __RenVMSignatureVerifier_init(address mintAuthority_) external initializer {
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
    function isValidSignature(bytes32 sigHash, bytes memory signature)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        address mingAuthority_ = mintAuthority();
        require(mingAuthority_ != address(0x0), "SignatureVerifier: mintAuthority not initialized");
        if (mingAuthority_ == ECDSA.recover(sigHash, signature)) {
            return CORRECT_SIGNATURE_RETURN_VALUE;
        } else {
            return INCORRECT_SIGNATURE_RETURN_VALUE;
        }
    }
}

contract RenVMSignatureVerifierProxy is TransparentUpgradeableProxy {
    constructor(
        address logic,
        address admin,
        bytes memory data
    ) payable TransparentUpgradeableProxy(logic, admin, data) {}
}
