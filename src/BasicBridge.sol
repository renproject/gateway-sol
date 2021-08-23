pragma solidity ^0.8.7;

import "./GatewayRegistry/interfaces/IGatewayRegistry.sol";
import "./Gateways/interfaces/IMintGateway.sol";

contract BasicBridge {
    IGatewayRegistry registry;

    constructor(IGatewayRegistry _registry) {
        registry = _registry;
    }

    function mint(
        // Payload
        string calldata _symbol,
        address _recipient,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(_symbol, _recipient));
        uint256 amount = registry.getMintGatewayBySymbol(_symbol).mint(payloadHash, _amount, _nHash, _sig);
        registry.getRenAssetBySymbol(_symbol).transfer(_recipient, amount);
    }

    function burn(
        string calldata _symbol,
        bytes calldata _to,
        uint256 _amount
    ) external {
        require(
            registry.getRenAssetBySymbol(_symbol).transferFrom(msg.sender, address(this), _amount),
            "token transfer failed"
        );
        registry.getMintGatewayBySymbol(_symbol).burn(_to, _amount);
    }

    function lock(
        string calldata _symbol,
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_
    ) external {
        require(
            registry.getLockAssetBySymbol(_symbol).transferFrom(msg.sender, address(this), amount_),
            "token transfer failed"
        );
        registry.getLockGatewayBySymbol(_symbol).lock(recipientAddress_, recipientChain_, recipientPayload_, amount_);
    }

    function release(
        // Payload
        string calldata _symbol,
        address _recipient,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(_symbol, _recipient));
        uint256 amount = registry.getLockGatewayBySymbol(_symbol).release(payloadHash, _amount, _nHash, _sig);
        registry.getRenAssetBySymbol(_symbol).transfer(_recipient, amount);
    }
}
