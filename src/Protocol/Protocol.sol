// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/** The Protocol contract is used to look-up other Ren contracts. */
contract Protocol is AccessControlEnumerable {
    event LogContractUpdated(string contractName, address indexed contractAddress, string indexed contractNameIndexed);

    mapping(string => address) internal contractMap;

    bytes32 public constant CAN_ADD_CONTRACTS = keccak256("CAN_ADD_CONTRACTS");
    bytes32 public constant CAN_UPDATE_CONTRACTS = keccak256("CAN_UPDATE_CONTRACTS");

    constructor(address adminAddress, address[] memory contractAdders) {
        _setupRole(AccessControl.DEFAULT_ADMIN_ROLE, adminAddress);
        _setupRole(CAN_ADD_CONTRACTS, adminAddress);
        _setupRole(CAN_UPDATE_CONTRACTS, adminAddress);

        for (uint256 i = 0; i < contractAdders.length; i++) {
            _setupRole(CAN_ADD_CONTRACTS, contractAdders[i]);
        }
    }

    function addContract(string memory contractName, address contractAddress) public onlyRole(CAN_ADD_CONTRACTS) {
        require(contractMap[contractName] == address(0x0), "Protocol: contract entry already exists");
        contractMap[contractName] = contractAddress;

        emit LogContractUpdated(contractName, contractAddress, contractName);
    }

    function updateContract(string memory contractName, address contractAddress) public onlyRole(CAN_UPDATE_CONTRACTS) {
        contractMap[contractName] = contractAddress;

        emit LogContractUpdated(contractName, contractAddress, contractName);
    }

    function getContract(string memory contractName) public view returns (address) {
        return contractMap[contractName];
    }
}
