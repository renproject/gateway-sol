/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { BTCGateway, BTCGatewayInterface } from "../BTCGateway";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "previousAdmin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "AdminChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "Upgraded",
    type: "event",
  },
  {
    payable: true,
    stateMutability: "payable",
    type: "fallback",
  },
  {
    constant: false,
    inputs: [],
    name: "admin",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "newAdmin",
        type: "address",
      },
    ],
    name: "changeAdmin",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [],
    name: "implementation",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "_logic",
        type: "address",
      },
      {
        internalType: "address",
        name: "_admin",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "initialize",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "_logic",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "initialize",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
    ],
    name: "upgradeTo",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50610d02806100206000396000f3fe6080604052600436106100705760003560e01c80638f2839701161004e5780638f283970146101bb578063cf7a1d771461020c578063d1f5789414610307578063f851a440146103e257610070565b80633659cfe61461007a5780634f1ef286146100cb5780635c60da1b14610164575b610078610439565b005b34801561008657600080fd5b506100c96004803603602081101561009d57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610453565b005b610162600480360360408110156100e157600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019064010000000081111561011e57600080fd5b82018360208201111561013057600080fd5b8035906020019184600183028401116401000000008311171561015257600080fd5b90919293919293905050506104a8565b005b34801561017057600080fd5b5061017961057e565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b3480156101c757600080fd5b5061020a600480360360208110156101de57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506105d6565b005b6103056004803603606081101561022257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019064010000000081111561027f57600080fd5b82018360208201111561029157600080fd5b803590602001918460018302840111640100000000831117156102b357600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f82011690508083019250505050505050919291929050505061074f565b005b6103e06004803603604081101561031d57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019064010000000081111561035a57600080fd5b82018360208201111561036c57600080fd5b8035906020019184600183028401116401000000008311171561038e57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050610811565b005b3480156103ee57600080fd5b506103f7610994565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6104416109ec565b61045161044c610a82565b610ab3565b565b61045b610ad9565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141561049c5761049781610b0a565b6104a5565b6104a4610439565b5b50565b6104b0610ad9565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415610570576104ec83610b0a565b60008373ffffffffffffffffffffffffffffffffffffffff168383604051808383808284378083019250505092505050600060405180830381855af49150503d8060008114610557576040519150601f19603f3d011682016040523d82523d6000602084013e61055c565b606091505b505090508061056a57600080fd5b50610579565b610578610439565b5b505050565b6000610588610ad9565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614156105ca576105c3610a82565b90506105d3565b6105d2610439565b5b90565b6105de610ad9565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141561074357600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415610697576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526036815260200180610c5d6036913960400191505060405180910390fd5b7f7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f6106c0610ad9565b82604051808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019250505060405180910390a161073e81610b59565b61074c565b61074b610439565b5b50565b600073ffffffffffffffffffffffffffffffffffffffff1661076f610a82565b73ffffffffffffffffffffffffffffffffffffffff161461078f57600080fd5b6107998382610811565b600160405180807f656970313936372e70726f78792e61646d696e000000000000000000000000008152506013019050604051809103902060001c0360001b7fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d610360001b1461080357fe5b61080c82610b59565b505050565b600073ffffffffffffffffffffffffffffffffffffffff16610831610a82565b73ffffffffffffffffffffffffffffffffffffffff161461085157600080fd5b600160405180807f656970313936372e70726f78792e696d706c656d656e746174696f6e00000000815250601c019050604051809103902060001c0360001b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc60001b146108bb57fe5b6108c482610b88565b6000815111156109905760008273ffffffffffffffffffffffffffffffffffffffff16826040518082805190602001908083835b6020831061091b57805182526020820191506020810190506020830392506108f8565b6001836020036101000a038019825116818451168082178552505050505050905001915050600060405180830381855af49150503d806000811461097b576040519150601f19603f3d011682016040523d82523d6000602084013e610980565b606091505b505090508061098e57600080fd5b505b5050565b600061099e610ad9565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614156109e0576109d9610ad9565b90506109e9565b6109e8610439565b5b90565b6109f4610ad9565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415610a78576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526032815260200180610c2b6032913960400191505060405180910390fd5b610a80610c15565b565b6000807f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc60001b9050805491505090565b3660008037600080366000845af43d6000803e8060008114610ad4573d6000f35b3d6000fd5b6000807fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d610360001b9050805491505090565b610b1381610b88565b8073ffffffffffffffffffffffffffffffffffffffff167fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b60405160405180910390a250565b60007fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d610360001b90508181555050565b610b9181610c17565b610be6576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252603b815260200180610c93603b913960400191505060405180910390fd5b60007f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc60001b90508181555050565b565b600080823b90506000811191505091905056fe43616e6e6f742063616c6c2066616c6c6261636b2066756e6374696f6e2066726f6d207468652070726f78792061646d696e43616e6e6f74206368616e6765207468652061646d696e206f6620612070726f787920746f20746865207a65726f206164647265737343616e6e6f742073657420612070726f787920696d706c656d656e746174696f6e20746f2061206e6f6e2d636f6e74726163742061646472657373a265627a7a723158203744668194633edf8da69d9c5aeaf64e889092a08981b641ab212950e090957064736f6c63430005110032";

export class BTCGateway__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<BTCGateway> {
    return super.deploy(overrides || {}) as Promise<BTCGateway>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): BTCGateway {
    return super.attach(address) as BTCGateway;
  }
  connect(signer: Signer): BTCGateway__factory {
    return super.connect(signer) as BTCGateway__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): BTCGatewayInterface {
    return new utils.Interface(_abi) as BTCGatewayInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): BTCGateway {
    return new Contract(address, _abi, signerOrProvider) as BTCGateway;
  }
}
