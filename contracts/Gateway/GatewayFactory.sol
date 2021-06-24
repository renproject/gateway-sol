pragma solidity ^0.5.17;

import "../Governance/Claimable.sol";
import "./GatewayRegistry.sol";
import "./MintGatewayV2.sol";
import "./RenERC20.sol";

contract GatewayFactory is Claimable {
    address public mintAuthority;
    GatewayRegistry public registry;
    string public chainName;

    constructor(address _mintAuthority, string memory _chainName)
        public
        Claimable()
    {
        Claimable.initialize(msg.sender);
        mintAuthority = _mintAuthority;
        registry = new GatewayRegistry();
        chainName = _chainName;
    }

    function addToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public onlyOwner {
        RenERC20LogicV1 token = new RenERC20LogicV1();
        token.initialize(
            1, // ChainID
            owner(), // Token owner
            1000000000000000000, // Token rate
            "1", // Token version
            _name,
            _symbol,
            _decimals
        );

        MintGatewayLogicV2 gateway = new MintGatewayLogicV2();
        gateway.initialize(
            token,
            owner(), // Fee recipient
            mintAuthority,
            15,
            15,
            0
        );

        gateway.updateSelectorHash(
            keccak256(abi.encodePacked(_symbol, "/to", chainName))
        );

        gateway.claimTokenOwnership();

        registry.setGateway(_symbol, address(token), address(gateway));
    }

    // Getters

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         address.
    ///
    /// @param _token The address of the RenERC20 token contract.
    function getGatewayByToken(address _token)
        external
        view
        returns (IGateway)
    {
        return registry.getGatewayByToken(_token);
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the RenERC20 token contract.
    function getGatewayBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IGateway)
    {
        return registry.getGatewayBySymbol(_tokenSymbol);
    }

    /// @notice Returns the RenERC20 address for the given token symbol.
    ///
    /// @param _tokenSymbol The symbol of the RenERC20 token contract to
    ///        lookup.
    function getTokenBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IERC20)
    {
        return registry.getTokenBySymbol(_tokenSymbol);
    }
}
