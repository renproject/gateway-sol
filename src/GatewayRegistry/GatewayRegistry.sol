// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMintGateway} from "../Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "../Gateways/interfaces/ILockGateway.sol";
import {ValidString} from "../libraries/ValidString.sol";
import {RenAssetFactory} from "./RenAssetFactory.sol";
import {StringSet} from "./StringSet.sol";

contract GatewayRegistryStateV2 {
    struct GatewayDetails {
        address gateway;
        address token;
    }

    StringSet.Set internal mintGatewaySymbols;
    StringSet.Set internal lockGatewaySymbols;

    mapping(address => string) internal mintSymbolByToken;
    mapping(string => GatewayDetails) internal mintGatewayDetailsBySymbol;

    mapping(address => string) internal lockSymbolByToken;
    mapping(string => GatewayDetails) internal lockGatewayDetailsBySymbol;

    address public signatureVerifier;

    uint256 public chainId;
    string public chainName;
}

contract GatewayRegistryGettersV2 is GatewayRegistryStateV2 {
    using StringSet for StringSet.Set;

    /// @dev To get all the registered Gateway contracts set count to `0`.
    function getMintGatewaySymbols(uint256 from_, uint256 count_) external view returns (string[] memory) {
        return enumerateSet(mintGatewaySymbols, from_, count_);
    }

    /// @dev To get all the registered tokens set count to `0`.
    function getLockGatewaySymbols(uint256 from_, uint256 count_) external view returns (string[] memory) {
        return enumerateSet(lockGatewaySymbols, from_, count_);
    }

    function enumerateSet(
        StringSet.Set storage set_,
        uint256 from_,
        uint256 count_
    ) internal view returns (string[] memory) {
        uint256 length = set_.length();

        if (count_ == 0 || from_ + count_ > length) {
            count_ = length - from_;
        }

        string[] memory gateways = new string[](count_);

        for (uint256 i = from_; i < from_ + count_; i++) {
            gateways[i] = set_.at(i);
        }

        return gateways;
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         address.
    ///
    /// @param token_ The address of the RenERC20 token contract.
    function getMintGatewayByToken(address token_) public view returns (IMintGateway) {
        return IMintGateway(mintGatewayDetailsBySymbol[mintSymbolByToken[token_]].gateway);
    }

    /// @notice Deprecated in favour of getMintGatewayByToken.
    function getGatewayByToken(address token_) external view returns (IMintGateway) {
        return getMintGatewayByToken(token_);
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         symbol.
    ///
    /// @param tokenSymbol_ The symbol of the RenERC20 token contract.
    function getMintGatewayBySymbol(string calldata tokenSymbol_) public view returns (IMintGateway) {
        return IMintGateway(mintGatewayDetailsBySymbol[tokenSymbol_].gateway);
    }

    /// @notice Deprecated in favour of getMintGatewayBySymbol.
    function getGatewayBySymbol(string calldata tokenSymbol_) external view returns (IMintGateway) {
        return getMintGatewayBySymbol(tokenSymbol_);
    }

    /// @notice Returns the RenERC20 address for the given token symbol.
    ///
    /// @param tokenSymbol_ The symbol of the RenERC20 token contract to
    ///        lookup.
    function getRenAssetBySymbol(string calldata tokenSymbol_) public view returns (IERC20) {
        return IERC20(mintGatewayDetailsBySymbol[tokenSymbol_].token);
    }

    /// @notice Deprecated in favour of getRenAssetBySymbol.
    function getTokenBySymbol(string calldata tokenSymbol_) external view returns (IERC20) {
        return getRenAssetBySymbol(tokenSymbol_);
    }

    function getLockGatewayByToken(address token_) external view returns (ILockGateway) {
        return ILockGateway(lockGatewayDetailsBySymbol[lockSymbolByToken[token_]].gateway);
    }

    function getLockGatewayBySymbol(string calldata tokenSymbol_) external view returns (ILockGateway) {
        return ILockGateway(lockGatewayDetailsBySymbol[tokenSymbol_].gateway);
    }

    function getLockAssetBySymbol(string calldata tokenSymbol_) external view returns (IERC20) {
        return IERC20(lockGatewayDetailsBySymbol[tokenSymbol_].gateway);
    }
}

/// @notice GatewayRegistry is a mapping from assets to their associated
/// RenERC20 and Gateway contracts.
contract GatewayRegistryV2 is
    Initializable,
    AccessControlEnumerableUpgradeable,
    RenAssetFactory,
    GatewayRegistryStateV2,
    GatewayRegistryGettersV2
{
    using StringSet for StringSet.Set;

    bytes32 public constant CAN_UPDATE_GATEWAYS = keccak256("CAN_UPDATE_GATEWAYS");
    bytes32 public constant CAN_ADD_GATEWAYS = keccak256("CAN_ADD_GATEWAYS");

    function __GatewayRegistry_init(
        string calldata chainName_,
        uint256 chainId_,
        address renAssetProxyBeacon_,
        address mintGatewayProxyBeacon_,
        address mintGatewayWithBurnStorageProxyBeacon_,
        address lockGatewayProxyBeacon_,
        address adminAddress_
    ) public initializer onlyValidString(chainName_) {
        __RenAssetFactory_init(
            renAssetProxyBeacon_,
            mintGatewayWithBurnStorageProxyBeacon_,
            mintGatewayProxyBeacon_,
            lockGatewayProxyBeacon_
        );
        chainName = chainName_;
        chainId = chainId_;
        AccessControlEnumerableUpgradeable._setupRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, adminAddress_);
        AccessControlEnumerableUpgradeable._setupRole(CAN_UPDATE_GATEWAYS, adminAddress_);
        AccessControlEnumerableUpgradeable._setupRole(CAN_ADD_GATEWAYS, adminAddress_);
    }

    /// @dev The symbol is included twice because strings have to be hashed
    /// first in order to be used as a log index/topic.
    event LogMintGatewayUpdated(
        string symbol,
        string indexed indexedSymbol,
        address indexed token,
        address indexed gatewayContract
    );
    event LogMintGatewayDeleted(string symbol, string indexed indexedSymbol);
    event LogLockGatewayUpdated(
        string symbol,
        string indexed indexedSymbol,
        address indexed token,
        address indexed gatewayContract
    );
    event LogLockGatewayDeleted(string symbol, string indexed indexedSymbol);

    event LogSignatureVerifierUpdated(address indexed newSignatureVerifier);

    modifier onlyValidString(string calldata str_) {
        require(ValidString.isValidString(str_), "GatewayRegistry: empty or invalid string input");
        _;
    }

    // GOVERNANCE //////////////////////////////////////////////////////////////

    /// @notice Allow the owner to update the signature verifier contract.
    ///
    /// @param nextSignatureVerifier_ The new verifier contract address.
    function updateSignatureVerifier(address nextSignatureVerifier_) public {
        require(
            hasRole(CAN_ADD_GATEWAYS, _msgSender()) || hasRole(CAN_UPDATE_GATEWAYS, _msgSender()),
            "GatewayRegistry: not authorized"
        );

        require(nextSignatureVerifier_ != address(0x0), "Gateway: invalid signature verifier");
        signatureVerifier = nextSignatureVerifier_;
        emit LogSignatureVerifierUpdated(signatureVerifier);
    }

    // MINT GATEWAYS ///////////////////////////////////////////////////////////

    /// @notice Allow the owner to set the Gateway contract for a given
    ///         RenERC20 token contract.
    ///
    /// @param symbol_ A string that identifies the token and gateway pair.
    /// @param renAsset_ The address of the RenERC20 token contract.
    /// @param mintGateway_ The address of the Gateway contract.
    function addMintGateway(
        string calldata symbol_,
        address renAsset_,
        address mintGateway_
    ) public onlyValidString(symbol_) {
        if (mintGatewaySymbols.contains(symbol_)) {
            // If there is an existing gateway for the symbol, delete it. Note
            // that this will check that the sender has the CAN_UPDATE_GATEWAYS
            // role.
            removeMintGateway(symbol_);
        } else {
            require(
                hasRole(CAN_ADD_GATEWAYS, _msgSender()) || hasRole(CAN_UPDATE_GATEWAYS, _msgSender()),
                "GatewayRegistry: not authorized"
            );
        }

        // Check that token, Gateway and symbol haven't already been registered.
        require(!mintGatewaySymbols.contains(symbol_), "GatewayRegistry: symbol already registered");
        require(bytes(mintSymbolByToken[renAsset_]).length == 0, "GatewayRegistry: token already registered");

        // Add to list of gateways.
        mintGatewaySymbols.add(symbol_);

        mintGatewayDetailsBySymbol[symbol_] = GatewayDetails({token: renAsset_, gateway: mintGateway_});
        mintSymbolByToken[renAsset_] = symbol_;

        emit LogMintGatewayUpdated(symbol_, symbol_, renAsset_, mintGateway_);
    }

    function deployMintGatewayAndRenAsset(
        string calldata asset_,
        string memory erc20Name_,
        string memory erc20Symbol_,
        uint8 erc20Decimals_,
        string memory version_
    ) external onlyRole(CAN_ADD_GATEWAYS) {
        require(bytes(chainName).length > 0, "GatewayRegistry: chain details not set");
        address token = address(_deployRenAsset(chainId, asset_, erc20Name_, erc20Symbol_, erc20Decimals_, version_));
        address mintGateway = address(_deployMintGateway(chainName, asset_, signatureVerifier, token, version_));
        Ownable(token).transferOwnership(mintGateway);
        addMintGateway(asset_, token, mintGateway);
    }

    function deployMintGatewayWithBurnStorageAndRenAsset(
        string calldata asset_,
        string memory erc20Name_,
        string memory erc20Symbol_,
        uint8 erc20Decimals_,
        string memory version_
    ) external onlyRole(CAN_ADD_GATEWAYS) {
        require(bytes(chainName).length > 0, "GatewayRegistry: chain details not set");
        address token = address(_deployRenAsset(chainId, asset_, erc20Name_, erc20Symbol_, erc20Decimals_, version_));
        address mintGateway = address(
            _deployMintGatewayWithBurnStorage(chainName, asset_, signatureVerifier, token, version_)
        );
        Ownable(token).transferOwnership(mintGateway);
        addMintGateway(asset_, token, mintGateway);
    }

    /// @notice Allows the owner to remove the Gateway contract for a given
    ///         RenERC20 contract.
    ///
    /// @param symbol_ The symbol of the token to deregister.
    function removeMintGateway(string calldata symbol_) public onlyRole(CAN_UPDATE_GATEWAYS) {
        require(mintGatewayDetailsBySymbol[symbol_].token != address(0x0), "GatewayRegistry: gateway not registered");

        address renAsset = mintGatewayDetailsBySymbol[symbol_].token;

        // Remove token and Gateway contract
        delete mintSymbolByToken[renAsset];
        delete mintGatewayDetailsBySymbol[symbol_];
        mintGatewaySymbols.remove(symbol_);

        emit LogMintGatewayDeleted(symbol_, symbol_);
    }

    // LOCK GATEWAYS ///////////////////////////////////////////////////////////

    /// @notice Allow the owner to set the Gateway contract for a given
    ///         RenERC20 token contract.
    ///
    /// @param symbol_ A string that identifies the token and gateway pair.
    /// @param lockAsset_ The address of the RenERC20 token contract.
    /// @param lockGateway_ The address of the Gateway contract.
    function addLockGateway(
        string calldata symbol_,
        address lockAsset_,
        address lockGateway_
    ) public onlyValidString(symbol_) {
        if (lockGatewaySymbols.contains(symbol_)) {
            // If there is an existing gateway for the symbol, delete it. Note
            // that this will check that the sender has the CAN_UPDATE_GATEWAYS
            // role.
            removeLockGateway(symbol_);
        } else {
            require(
                hasRole(CAN_ADD_GATEWAYS, _msgSender()) || hasRole(CAN_UPDATE_GATEWAYS, _msgSender()),
                "GatewayRegistry: not authorized"
            );
        }

        // Check that token, Gateway and symbol haven't already been registered.
        require(!lockGatewaySymbols.contains(symbol_), "GatewayRegistry: symbol already registered");
        require(bytes(lockSymbolByToken[lockAsset_]).length == 0, "GatewayRegistry: token already registered");

        // Add to list of gateways.
        lockGatewaySymbols.add(symbol_);

        lockGatewayDetailsBySymbol[symbol_] = GatewayDetails({token: lockAsset_, gateway: lockGateway_});
        lockSymbolByToken[lockAsset_] = symbol_;

        emit LogLockGatewayUpdated(symbol_, symbol_, lockAsset_, lockGateway_);
    }

    function deployLockGateway(
        string calldata asset_,
        address lockToken,
        string memory version_
    ) external onlyRole(CAN_ADD_GATEWAYS) {
        require(bytes(chainName).length > 0, "GatewayRegistry: chain details not set");
        address lockGateway = address(_deployLockGateway(chainName, asset_, signatureVerifier, lockToken, version_));
        addLockGateway(asset_, lockToken, lockGateway);
    }

    /// @notice Allows the owner to remove the Gateway contract for a given
    ///         asset contract.
    ///
    /// @param symbol_ The symbol of the token to deregister.
    function removeLockGateway(string calldata symbol_) public onlyRole(CAN_UPDATE_GATEWAYS) {
        require(lockGatewaySymbols.contains(symbol_), "GatewayRegistry: gateway not registered");

        address lockAsset = lockGatewayDetailsBySymbol[symbol_].token;

        // Remove token and Gateway contract
        delete lockSymbolByToken[lockAsset];
        delete lockGatewayDetailsBySymbol[symbol_];
        lockGatewaySymbols.remove(symbol_);

        emit LogLockGatewayDeleted(symbol_, symbol_);
    }
}
