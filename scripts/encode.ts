import AbiCoder from "web3-eth-abi";

export const encodeCallData = (
    functioName: any,
    parameterTypes: any,
    parameters: any
) => {
    const coder = AbiCoder as unknown as AbiCoder.AbiCoder;
    return (
        coder.encodeFunctionSignature(
            `${functioName}(${parameterTypes.join(",")})`
        ) + coder.encodeParameters(parameterTypes, parameters).slice(2)
    );
};
