/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type { IBurnGateway, IBurnGatewayInterface } from "../IBurnGateway";

const _abi = [
  {
    constant: false,
    inputs: [
      {
        internalType: "bytes",
        name: "_to",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "_amountScaled",
        type: "uint256",
      },
    ],
    name: "burn",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "burnFee",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

export class IBurnGateway__factory {
  static readonly abi = _abi;
  static createInterface(): IBurnGatewayInterface {
    return new utils.Interface(_abi) as IBurnGatewayInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IBurnGateway {
    return new Contract(address, _abi, signerOrProvider) as IBurnGateway;
  }
}
