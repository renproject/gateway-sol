// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./GatewayRegistry/interfaces/IGatewayRegistry.sol";
import {IMintGateway} from "./Gateways/interfaces/IMintGateway.sol";
import {ILockGateway} from "./Gateways/interfaces/ILockGateway.sol";

contract BasicBridge {
    using SafeERC20 for IERC20;

    event LogTransferred(address indexed to, uint256 amount);

    IGatewayRegistry registry;

    constructor(IGatewayRegistry _registry) {
        registry = _registry;
    }

    function mint(
        // Payload
        string calldata symbol,
        address recipient,
        // Required
        uint256 amount,
        bytes32 nHash,
        bytes calldata sig
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(symbol, recipient));
        uint256 amountMinted = registry.getMintGatewayBySymbol(symbol).mint(payloadHash, amount, nHash, sig);
        registry.getRenAssetBySymbol(symbol).safeTransfer(recipient, amountMinted);
    }

    function burn(
        string calldata symbol,
        string calldata to,
        uint256 amount
    ) external {
        registry.getRenAssetBySymbol(symbol).safeTransferFrom(msg.sender, address(this), amount);
        registry.getMintGatewayBySymbol(symbol).burn(bytes(to), amount);
    }

    function lock(
        string calldata symbol,
        string memory recipientAddress,
        string memory recipientChain,
        bytes memory recipientPayload,
        uint256 amount
    ) external {
        IERC20 lockAsset = registry.getLockAssetBySymbol(symbol);
        ILockGateway gateway = registry.getLockGatewayBySymbol(symbol);
        lockAsset.safeTransferFrom(msg.sender, address(this), amount);
        lockAsset.approve(address(gateway), amount);
        gateway.lock(recipientAddress, recipientChain, recipientPayload, amount);
    }

    function release(
        // Payload
        string calldata symbol,
        address recipient,
        // Required
        uint256 amount,
        bytes32 nHash,
        bytes calldata sig
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(symbol, recipient));
        uint256 amountReleased = registry.getLockGatewayBySymbol(symbol).release(payloadHash, amount, nHash, sig);
        registry.getRenAssetBySymbol(symbol).safeTransfer(recipient, amountReleased);
    }

    function transferWithLog(address payable to) public payable {
        uint256 amount = msg.value;
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "eth transfer failed");
        emit LogTransferred(to, amount);
    }
}
