// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

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

    address internal _signatureVerifier;

    uint256 internal _chainId;
    string internal _chainName;
}

contract GatewayRegistryGettersV2 is GatewayRegistryStateV2 {
    using StringSet for StringSet.Set;

    function signatureVerifier() public view returns (address) {
        return _signatureVerifier;
    }

    function chainId() public view returns (uint256) {
        return _chainId;
    }

    function chainName() public view returns (string memory) {
        return _chainName;
    }

    /// @dev To get all the registered Gateway contracts set count to `0`.
    function getMintGatewaySymbols(uint256 from, uint256 count) external view returns (string[] memory) {
        return enumerateSet(mintGatewaySymbols, from, count);
    }

    /// @dev To get all the registered tokens set count to `0`.
    function getLockGatewaySymbols(uint256 from, uint256 count) external view returns (string[] memory) {
        return enumerateSet(lockGatewaySymbols, from, count);
    }

    function enumerateSet(
        StringSet.Set storage set,
        uint256 from,
        uint256 count
    ) internal view returns (string[] memory) {
        uint256 length = set.length();

        if (count == 0 || from + count > length) {
            count = length - from;
        }

        string[] memory gateways = new string[](count);

        for (uint256 i = from; i < from + count; i++) {
            gateways[i] = set.at(i);
        }

        return gateways;
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         address.
    ///
    /// @param token The address of the RenERC20 token contract.
    function getMintGatewayByToken(address token) public view returns (IMintGateway) {
        return IMintGateway(mintGatewayDetailsBySymbol[mintSymbolByToken[token]].gateway);
    }

    /// @notice Deprecated in favour of getMintGatewayByToken.
    function getGatewayByToken(address token) external view returns (IMintGateway) {
        return getMintGatewayByToken(token);
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         symbol.
    ///
    /// @param tokenSymbol The symbol of the RenERC20 token contract.
    function getMintGatewayBySymbol(string calldata tokenSymbol) public view returns (IMintGateway) {
        return IMintGateway(mintGatewayDetailsBySymbol[tokenSymbol].gateway);
    }

    /// @notice Deprecated in favour of getMintGatewayBySymbol.
    function getGatewayBySymbol(string calldata tokenSymbol) external view returns (IMintGateway) {
        return getMintGatewayBySymbol(tokenSymbol);
    }

    /// @notice Returns the RenERC20 address for the given token symbol.
    ///
    /// @param tokenSymbol The symbol of the RenERC20 token contract to
    ///        lookup.
    function getRenAssetBySymbol(string calldata tokenSymbol) public view returns (IERC20) {
        return IERC20(mintGatewayDetailsBySymbol[tokenSymbol].token);
    }

    /// @notice Deprecated in favour of getRenAssetBySymbol.
    function getTokenBySymbol(string calldata tokenSymbol) external view returns (IERC20) {
        return getRenAssetBySymbol(tokenSymbol);
    }

    function getLockGatewayByToken(address token_) external view returns (ILockGateway) {
        return ILockGateway(lockGatewayDetailsBySymbol[lockSymbolByToken[token_]].gateway);
    }

    function getLockGatewayBySymbol(string calldata tokenSymbol) external view returns (ILockGateway) {
        return ILockGateway(lockGatewayDetailsBySymbol[tokenSymbol].gateway);
    }

    function getLockAssetBySymbol(string calldata tokenSymbol) external view returns (IERC20) {
        return IERC20(lockGatewayDetailsBySymbol[tokenSymbol].token);
    }
}

/// GatewayRegistry is a mapping from assets to their associated
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
        address lockGatewayProxyBeacon_,
        address adminAddress
    ) external initializer onlyValidString(chainName_) {
        __RenAssetFactory_init(renAssetProxyBeacon_, mintGatewayProxyBeacon_, lockGatewayProxyBeacon_);
        _chainName = chainName_;
        _chainId = chainId_;
        AccessControlEnumerableUpgradeable._setupRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, adminAddress);
        AccessControlEnumerableUpgradeable._setupRole(CAN_UPDATE_GATEWAYS, adminAddress);
        AccessControlEnumerableUpgradeable._setupRole(CAN_ADD_GATEWAYS, adminAddress);
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

    // MODIFIERS ///////////////////////////////////////////////////////////////

    modifier onlyValidString(string calldata str_) {
        require(ValidString.isValidString(str_), "GatewayRegistry: empty or invalid string input");
        _;
    }

    /// @notice Modifier to require the caller to have at least one of two roles.
    modifier onlyAtLeastOneRole(bytes32 role1, bytes32 role2) {
        address account = _msgSender();
        if (!hasRole(role1, account) && !hasRole(role2, account)) {
            revert(
                string(
                    abi.encodePacked(
                        "AccessControl: account ",
                        StringsUpgradeable.toHexString(uint160(account), 20),
                        " is missing roles ",
                        StringsUpgradeable.toHexString(uint256(role1), 32),
                        " or ",
                        StringsUpgradeable.toHexString(uint256(role2), 32)
                    )
                )
            );
        }
        _;
    }

    // GOVERNANCE //////////////////////////////////////////////////////////////

    /// @notice Allow the owner to update the signature verifier contract.
    ///
    /// @param nextSignatureVerifier The new verifier contract address.
    function updateSignatureVerifier(address nextSignatureVerifier)
        external
        onlyAtLeastOneRole(CAN_ADD_GATEWAYS, CAN_UPDATE_GATEWAYS)
    {
        require(nextSignatureVerifier != address(0x0), "Gateway: invalid signature verifier");
        _signatureVerifier = nextSignatureVerifier;
        emit LogSignatureVerifierUpdated(_signatureVerifier);
    }

    // MINT GATEWAYS ///////////////////////////////////////////////////////////

    /// @notice Allow the owner to set the Gateway contract for a given
    ///         RenERC20 token contract.
    ///
    /// @param symbol A string that identifies the token and gateway pair.
    /// @param renAsset The address of the RenERC20 token contract.
    /// @param mintGateway The address of the Gateway contract.
    function addMintGateway(
        string calldata symbol,
        address renAsset,
        address mintGateway
    ) public onlyValidString(symbol) onlyAtLeastOneRole(CAN_ADD_GATEWAYS, CAN_UPDATE_GATEWAYS) {
        if (mintGatewaySymbols.contains(symbol)) {
            // If there is an existing gateway for the symbol, delete it. Note
            // that this will check that the sender has the CAN_UPDATE_GATEWAYS
            // role.
            removeMintGateway(symbol);
        }

        // Check that token, Gateway and symbol haven't already been registered.
        require(!mintGatewaySymbols.contains(symbol), "GatewayRegistry: symbol already registered");
        require(bytes(mintSymbolByToken[renAsset]).length == 0, "GatewayRegistry: token already registered");

        // Add to list of gateways.
        mintGatewaySymbols.add(symbol);

        mintGatewayDetailsBySymbol[symbol] = GatewayDetails({token: renAsset, gateway: mintGateway});
        mintSymbolByToken[renAsset] = symbol;

        emit LogMintGatewayUpdated(symbol, symbol, renAsset, mintGateway);
    }

    function deployMintGateway(
        string calldata symbol,
        address renAsset,
        string memory version
    ) external onlyRole(CAN_ADD_GATEWAYS) {
        string memory chainName_ = chainName();
        require(bytes(chainName_).length > 0, "GatewayRegistry: chain details not set");
        if (lockGatewaySymbols.contains(symbol)) {
            _checkRole(CAN_UPDATE_GATEWAYS, _msgSender());
        }

        address mintGateway = address(_deployMintGateway(chainName_, symbol, signatureVerifier(), renAsset, version));
        addMintGateway(symbol, renAsset, mintGateway);
    }

    function deployMintGatewayAndRenAsset(
        string calldata symbol,
        string memory erc20Name,
        string memory erc20Symbol,
        uint8 erc20Decimals,
        string memory version
    ) external onlyRole(CAN_ADD_GATEWAYS) {
        string memory chainName_ = chainName();
        require(bytes(chainName_).length > 0, "GatewayRegistry: chain details not set");
        if (lockGatewaySymbols.contains(symbol)) {
            revert(string(abi.encodePacked("GatewayRegistry: ", symbol, " mint gateway already registered")));
        }

        address renAsset = address(_deployRenAsset(chainId(), symbol, erc20Name, erc20Symbol, erc20Decimals, version));
        address mintGateway = address(_deployMintGateway(chainName_, symbol, signatureVerifier(), renAsset, version));
        Ownable(renAsset).transferOwnership(mintGateway);
        addMintGateway(symbol, renAsset, mintGateway);
    }

    /// @notice Allows the owner to remove the Gateway contract for a given
    ///         RenERC20 contract.
    ///
    /// @param symbol The symbol of the token to deregister.
    function removeMintGateway(string calldata symbol) public onlyRole(CAN_UPDATE_GATEWAYS) {
        require(mintGatewayDetailsBySymbol[symbol].token != address(0x0), "GatewayRegistry: gateway not registered");

        address renAsset = mintGatewayDetailsBySymbol[symbol].token;

        // Remove token and Gateway contract
        delete mintSymbolByToken[renAsset];
        delete mintGatewayDetailsBySymbol[symbol];
        mintGatewaySymbols.remove(symbol);

        emit LogMintGatewayDeleted(symbol, symbol);
    }

    // LOCK GATEWAYS ///////////////////////////////////////////////////////////

    /// @notice Allow the owner to set the Gateway contract for a given
    ///         RenERC20 token contract.
    ///
    /// @param symbol A string that identifies the token and gateway pair.
    /// @param lockAsset The address of the RenERC20 token contract.
    /// @param lockGateway The address of the Gateway contract.
    function addLockGateway(
        string calldata symbol,
        address lockAsset,
        address lockGateway
    ) public onlyValidString(symbol) onlyAtLeastOneRole(CAN_ADD_GATEWAYS, CAN_UPDATE_GATEWAYS) {
        if (lockGatewaySymbols.contains(symbol)) {
            // If there is an existing gateway for the symbol, delete it. Note
            // that this will check that the sender has the CAN_UPDATE_GATEWAYS
            // role.
            removeLockGateway(symbol);
        }

        // Check that token, Gateway and symbol haven't already been registered.
        require(!lockGatewaySymbols.contains(symbol), "GatewayRegistry: symbol already registered");
        require(bytes(lockSymbolByToken[lockAsset]).length == 0, "GatewayRegistry: token already registered");

        // Add to list of gateways.
        lockGatewaySymbols.add(symbol);

        lockGatewayDetailsBySymbol[symbol] = GatewayDetails({token: lockAsset, gateway: lockGateway});
        lockSymbolByToken[lockAsset] = symbol;

        emit LogLockGatewayUpdated(symbol, symbol, lockAsset, lockGateway);
    }

    function deployLockGateway(
        string calldata symbol,
        address lockToken,
        string memory version
    ) external onlyRole(CAN_ADD_GATEWAYS) {
        string memory chainName_ = chainName();

        require(bytes(chainName_).length > 0, "GatewayRegistry: chain details not set");

        if (lockGatewaySymbols.contains(symbol)) {
            _checkRole(CAN_UPDATE_GATEWAYS, _msgSender());
        }

        address lockGateway = address(_deployLockGateway(chainName_, symbol, signatureVerifier(), lockToken, version));
        addLockGateway(symbol, lockToken, lockGateway);
    }

    /// @notice Allows the owner to remove the Gateway contract for a given
    ///         asset contract.
    ///
    /// @param symbol The symbol of the token to deregister.
    function removeLockGateway(string calldata symbol) public onlyRole(CAN_UPDATE_GATEWAYS) {
        require(lockGatewaySymbols.contains(symbol), "GatewayRegistry: gateway not registered");

        address lockAsset = lockGatewayDetailsBySymbol[symbol].token;

        // Remove token and Gateway contract
        delete lockSymbolByToken[lockAsset];
        delete lockGatewayDetailsBySymbol[symbol];
        lockGatewaySymbols.remove(symbol);

        emit LogLockGatewayDeleted(symbol, symbol);
    }
}

contract GatewayRegistryProxy is TransparentUpgradeableProxy {
    constructor(
        address logic,
        address admin,
        bytes memory data
    ) payable TransparentUpgradeableProxy(logic, admin, data) {}
}
