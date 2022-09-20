// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {EDDSA} from "./EDDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

import "hardhat/console.sol";

interface IRenVMSignatureVerifier is IERC1271 {
    // See IERC1271

    function getChain() external view returns (string memory);

    function getMintAuthority() external view returns (bytes memory);
}

contract RenVMSignatureVerifierStateV2 {
    string internal _chain;
    bytes internal _mintAuthority;

    // Leave a gap so that storage values added in future upgrages don't corrupt
    // the storage of contracts that inherit from this contract.
    uint256[48] private __gap;
}

// ERC-1271 uses 4-byte value instead of a boolean so that if a bug causes
// another function to be called (e.g. by proxy misconfiguration or fallbacks),
// a truthy value would not be interpreted as a successful check.
// See https://github.com/ethereum/EIPs/issues/1271#issuecomment-442328339.
bytes4 constant CORRECT_SIGNATURE_RETURN_VALUE_ = 0x1626ba7e;

contract RenVMSignatureVerifierV2 is
    Initializable,
    ContextUpgradeable,
    OwnableUpgradeable,
    RenVMSignatureVerifierStateV2,
    IERC1271,
    IRenVMSignatureVerifier
{
    string public constant NAME = "RenVMSignatureVerifier";

    event LogMintAuthorityUpdated(bytes indexed oldPubKey, bytes indexed newPubKey);

    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 public constant CORRECT_SIGNATURE_RETURN_VALUE = 0x1626ba7e; // CORRECT_SIGNATURE_RETURN_VALUE_
    bytes4 public constant INCORRECT_SIGNATURE_RETURN_VALUE = 0x000000;

    function __RenVMSignatureVerifier_init(
        string calldata chain_,
        bytes calldata mintAuthority_,
        address contractOwner
    ) external initializer {
        __Context_init();
        __Ownable_init();
        _chain = chain_;

        updateMintAuthority(mintAuthority_);
        console.log("updated mint authority", _mintAuthority.length);

        if (owner() != contractOwner) {
            transferOwnership(contractOwner);
        }
    }

    function getChain() public view override returns (string memory) {
        return _chain;
    }

    function getMintAuthority() public view override returns (bytes memory) {
        return RenVMSignatureVerifierStateV2._mintAuthority;
    }

    /// @notice Allow the owner to update the mint authority.
    ///
    /// @param _nextMintAuthority The new mint mint authority.
    function updateMintAuthority(bytes memory _nextMintAuthority) public onlyOwner {
        EDDSA.validate(_nextMintAuthority);
        emit LogMintAuthorityUpdated(_mintAuthority, _nextMintAuthority);
        RenVMSignatureVerifierStateV2._mintAuthority = _nextMintAuthority;
    }

    // PUBLIC //////////////////////////////////////////////////////////////////

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters. Returns a 4-byte value as defined by ERC1271.
    function isValidSignature(bytes32 sigHash, bytes calldata signature) external view override returns (bytes4) {
        bytes memory mintAuthority_ = getMintAuthority();
        require(mintAuthority_.length != 0, "SignatureVerifier: mintAuthority not initialized");
        if (EDDSA.verify(mintAuthority_, sigHash, signature)) {
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
