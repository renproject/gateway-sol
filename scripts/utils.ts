import BigNumber from "bignumber.js";
import BN from "bn.js";
import { green, yellow } from "chalk";
import { ContractFactory } from "ethers";
import { ethers } from "hardhat";

export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export const at = async <Factory extends ContractFactory>(
    contractName: string,
    address: string
): Promise<ReturnType<Factory["attach"]>> => {
    const signers = await ethers.getSigners();

    const factory = (await ethers.getContractFactory(
        contractName,
        signers[0]
    )) as Factory;

    // If we had constructor arguments, they would be passed into deploy()
    const contract = await factory.attach(address);
    return contract as ReturnType<Factory["attach"]>;
};

export const deploy = async <Factory extends ContractFactory>(
    contractName: string,
    ...params: Parameters<Factory["deploy"]>
): Promise<ReturnType<Factory["attach"]>> => {
    const signers = await ethers.getSigners();

    const factory = (await ethers.getContractFactory(
        contractName,
        signers[0]
    )) as Factory;

    // If we had constructor arguments, they would be passed into deploy()
    const contract = await factory.deploy(...params);

    // The address the Contract WILL have once mined
    //   console.log(contract.address);

    // The transaction that was sent to the network to deploy the Contract
    // process.stdout.write(
    console.log(
        `${yellow("Deploying")} ${contractName} ${
            contract.deployTransaction.hash
        }...`
    );

    // The contract is NOT deployed yet; we must wait until it is mined
    await contract.deployed();

    console.log(
        `\r\u001b[0K\r${green("Deployed")} ${contractName}(${params
            .map(String)
            .join(", ")}) at ${contract.address}`
    );

    await sleep(1 * 1000);

    return contract as ReturnType<Factory["attach"]>;
};

export const printDeployerInfo = async () => {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log(
        "Account balance:",
        new BigNumber((await deployer.getBalance()).toString())
            .dividedBy(new BigNumber(10).exponentiatedBy(18))
            .toString(),
        "ETH"
    );
};

export const toEth = (num: string | number | BigNumber | BN) =>
    new BigNumber(BigNumber.isBigNumber(num) ? num : num.toString())
        .times(new BigNumber(10).exponentiatedBy(18))
        .toFixed();
