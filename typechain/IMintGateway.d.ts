/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
  BaseContract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";
import { TypedEventFilter, TypedEvent, TypedListener } from "./commons";

interface IMintGatewayInterface extends ethers.utils.Interface {
  functions: {
    "mint(bytes32,uint256,bytes32,bytes)": FunctionFragment;
    "mintFee()": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "mint",
    values: [BytesLike, BigNumberish, BytesLike, BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "mintFee", values?: undefined): string;

  decodeFunctionResult(functionFragment: "mint", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "mintFee", data: BytesLike): Result;

  events: {};
}

export class IMintGateway extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  listeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter?: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): Array<TypedListener<EventArgsArray, EventArgsObject>>;
  off<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  on<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  once<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeListener<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeAllListeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): this;

  listeners(eventName?: string): Array<Listener>;
  off(eventName: string, listener: Listener): this;
  on(eventName: string, listener: Listener): this;
  once(eventName: string, listener: Listener): this;
  removeListener(eventName: string, listener: Listener): this;
  removeAllListeners(eventName?: string): this;

  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>;

  interface: IMintGatewayInterface;

  functions: {
    mint(
      _pHash: BytesLike,
      _amount: BigNumberish,
      _nHash: BytesLike,
      _sig: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    mintFee(overrides?: CallOverrides): Promise<[BigNumber]>;
  };

  mint(
    _pHash: BytesLike,
    _amount: BigNumberish,
    _nHash: BytesLike,
    _sig: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  mintFee(overrides?: CallOverrides): Promise<BigNumber>;

  callStatic: {
    mint(
      _pHash: BytesLike,
      _amount: BigNumberish,
      _nHash: BytesLike,
      _sig: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    mintFee(overrides?: CallOverrides): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    mint(
      _pHash: BytesLike,
      _amount: BigNumberish,
      _nHash: BytesLike,
      _sig: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    mintFee(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    mint(
      _pHash: BytesLike,
      _amount: BigNumberish,
      _nHash: BytesLike,
      _sig: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    mintFee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
