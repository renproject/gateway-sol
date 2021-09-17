// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./GatewayRegistry/interfaces/IGatewayRegistry.sol";
import {IMintGateway} from "./Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "./Gateways/interfaces/ILockGateway.sol";

contract BasicBridge {
    IGatewayRegistry registry;

    constructor(IGatewayRegistry _registry) {
        registry = _registry;
    }

    function mint(
        // Payload
        string calldata symbol_,
        address recipient_,
        // Required
        uint256 amount_,
        bytes32 nHash_,
        bytes calldata sig_
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(symbol_, recipient_));
        uint256 amount = registry.getMintGatewayBySymbol(symbol_).mint(payloadHash, amount_, nHash_, sig_);
        registry.getRenAssetBySymbol(symbol_).transfer(recipient_, amount);
    }

    function burn(
        string calldata symbol_,
        string calldata to_,
        uint256 amount_
    ) external {
        require(
            registry.getRenAssetBySymbol(symbol_).transferFrom(msg.sender, address(this), amount_),
            "token transfer failed"
        );
        registry.getMintGatewayBySymbol(symbol_).burn(bytes(to_), amount_);
    }

    function lock(
        string calldata symbol_,
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 amount_
    ) external {
        IERC20 lockAsset = registry.getLockAssetBySymbol(symbol_);
        ILockGateway gateway = registry.getLockGatewayBySymbol(symbol_);
        require(lockAsset.transferFrom(msg.sender, address(this), amount_), "token transfer failed");
        lockAsset.approve(address(gateway), amount_);
        gateway.lock(recipientAddress_, recipientChain_, recipientPayload_, amount_);
    }

    function release(
        // Payload
        string calldata symbol_,
        address recipient_,
        // Required
        uint256 amount_,
        bytes32 nHash_,
        bytes calldata sig_
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(symbol_, recipient_));
        uint256 amount = registry.getLockGatewayBySymbol(symbol_).release(payloadHash, amount_, nHash_, sig_);
        registry.getRenAssetBySymbol(symbol_).transfer(recipient_, amount);
    }
}
