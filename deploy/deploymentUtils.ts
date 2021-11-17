import { randomBytes } from "crypto";
import { BaseContract, ContractFactory, ContractTransaction } from "ethers";
import { getAddress, keccak256 } from "ethers/lib/utils";
import { CallOptions, DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    AccessControlEnumerableUpgradeable,
    Ownable,
    RenProxyAdmin,
    TransparentUpgradeableProxy,
    TransparentUpgradeableProxy__factory,
} from "../typechain";

export const Ox0 = "0x0000000000000000000000000000000000000000";
export const CREATE2_DEPLOYER = "0x2222229fb3318a6375fa78fd299a9a42ac6a8fbf";
export interface ConsoleInterface {
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
}

export const create2Salt = (network: string) => (network.match(/Testnet$/) ? "REN.RC1" : `REN.RC1-${network}`);

export const setupGetExistingDeployment =
    (hre: HardhatRuntimeEnvironment) =>
    async <T extends BaseContract>(name: string): Promise<T | null> => {
        const { deployments, getNamedAccounts, ethers, network } = hre;
        const { getOrNull } = deployments;

        if (network.name === "hardhat") {
            return null;
        }

        const { deployer } = await getNamedAccounts();
        const result = await getOrNull(name);

        return result ? await ethers.getContractAt<T>(name, result.address, deployer) : result;
    };

export const setupDeploy =
    (hre: HardhatRuntimeEnvironment, logger: ConsoleInterface = console) =>
    async <
        F extends ContractFactory,
        C extends F extends { deploy: (...args: any) => Promise<infer C> } ? C : never = F extends {
            deploy: (...args: any) => Promise<infer C>;
        }
            ? C
            : never
    >(
        name: string,
        args: F extends { deploy: (...args: infer X) => Promise<any> } ? X : never,
        overrides?: CallOptions
    ): Promise<F extends { deploy: (...args: any) => Promise<infer C> } ? C : never> => {
        const { deployments, getNamedAccounts, ethers, network } = hre;
        const { deploy } = deployments;

        const { deployer } = await getNamedAccounts();
        logger.log(`Deploying ${name} from ${deployer}`);

        const result = await deploy(name, {
            from: deployer,
            args: args,
            log: true,
            skipIfAlreadyDeployed: false,
            ...overrides,
        });
        logger.log(`Deployed ${name} at ${result.address}.`);
        const contract = await ethers.getContractAt<C>(name, result.address, deployer);

        let owner;
        try {
            owner = await (contract as any as Ownable).owner();
        } catch (error) {}
        if (owner && owner.toLowerCase() === CREATE2_DEPLOYER) {
            throw new Error(`${name}'s owner was initialized to CREATE2 deployer!`);
        }

        let roleAdmin;
        try {
            roleAdmin = await (contract as any as AccessControlEnumerableUpgradeable).getRoleAdmin(
                await (contract as any as AccessControlEnumerableUpgradeable).DEFAULT_ADMIN_ROLE()
            );
        } catch (error) {}
        if (roleAdmin && roleAdmin.toLowerCase() === CREATE2_DEPLOYER) {
            throw new Error(`${name}'s role admin was initialized to CREATE2 deployer!`);
        }

        return contract;
    };

export const setupCreate2 =
    (hre: HardhatRuntimeEnvironment, create2SaltOverride?: string, logger: ConsoleInterface = console) =>
    async <
        F extends ContractFactory,
        C extends F extends { deploy: (...args: any) => Promise<infer C> } ? C : never = F extends {
            deploy: (...args: any) => Promise<infer C>;
        }
            ? C
            : never
    >(
        name: string,
        args: F extends { deploy: (...args: infer X) => Promise<any> } ? X : never,
        overrides?: CallOptions,
        create2SaltOverrideAlt?: string
    ): Promise<F extends { deploy: (...args: any) => Promise<infer C> } ? C : never> => {
        const { deployments, getNamedAccounts, ethers, network } = hre;
        const { deploy } = deployments;

        const { deployer } = await getNamedAccounts();
        const salt = keccak256(Buffer.from(create2SaltOverrideAlt || create2SaltOverride || create2Salt(network.name)));
        logger.log(`Deploying ${name} from ${deployer} (salt: keccak256(${create2Salt(network.name)}))`);

        const result = await deploy(name, {
            from: deployer,
            args: args,
            log: true,
            deterministicDeployment: salt,
            skipIfAlreadyDeployed: true,
            ...overrides,
        });
        logger.log(`Deployed ${name} at ${result.address}.`);
        const contract = await ethers.getContractAt<C>(name, result.address, deployer);

        let owner;
        try {
            owner = await (contract as any as Ownable).owner();
        } catch (error) {}
        if (owner && owner.toLowerCase() === CREATE2_DEPLOYER) {
            throw new Error(`${name}'s owner was initialized to CREATE2 deployer!`);
        }

        let roleAdmin;
        try {
            roleAdmin = await (contract as any as AccessControlEnumerableUpgradeable).getRoleAdmin(
                await (contract as any as AccessControlEnumerableUpgradeable).DEFAULT_ADMIN_ROLE()
            );
        } catch (error) {}
        if (roleAdmin && roleAdmin.toLowerCase() === CREATE2_DEPLOYER) {
            throw new Error(`${name}'s role admin was initialized to CREATE2 deployer!`);
        }

        return contract;
    };

export const setupDeployProxy =
    (
        hre: HardhatRuntimeEnvironment,
        create2: ReturnType<typeof setupCreate2>,
        proxyAdmin: RenProxyAdmin,
        logger: ConsoleInterface = console
    ) =>
    async <
        F extends ContractFactory,
        C extends F extends { deploy: () => Promise<infer C> } ? C : never = F extends {
            deploy: () => Promise<infer C>;
        }
            ? C
            : never
    >(
        contractName: string,
        proxyName: string,
        initialize: (t: C) => Promise<void>,
        create2SaltOverrideAlt?: string
    ): Promise<C> => {
        const { deployments, getNamedAccounts, ethers } = hre;

        const { deployer } = await getNamedAccounts();

        // const existingImplementationDeployment = (await deployments.getOrNull(contractName)) as unknown as T;
        // let implementation: T;
        // if (existingImplementationDeployment) {
        //     logger.log(`Reusing ${contractName} at ${existingImplementationDeployment.address}`);

        //     implementation = await ethers.getContractAt<T>(
        //         contractName,
        //         existingImplementationDeployment.address,
        //         deployer
        //     );
        // } else {
        const implementation = (await create2<F>(
            contractName,
            [] as any,
            undefined,
            create2SaltOverrideAlt
        )) as unknown as C;
        // }

        logger.log(`Initializing ${contractName} instance (optional).`);
        await initialize(implementation);

        const existingProxyDeployment = await setupGetExistingDeployment(hre)<TransparentUpgradeableProxy>(proxyName);
        logger.log("existingProxyDeployment", existingProxyDeployment);
        let proxy: TransparentUpgradeableProxy;
        if (existingProxyDeployment) {
            logger.log(`Reusing ${proxyName} at ${existingProxyDeployment.address}`);
            proxy = existingProxyDeployment;
            const currentImplementation = await proxyAdmin.getProxyImplementation(proxy.address);
            logger.log(proxyName, "points to", currentImplementation);
            if (currentImplementation.toLowerCase() !== implementation.address.toLowerCase()) {
                logger.log(
                    `Updating ${proxyName} to point to ${implementation.address} instead of ${currentImplementation}`
                );
                await setupWaitForTx(logger)(async () => proxyAdmin.upgrade(proxy.address, implementation.address));
            }
        } else {
            proxy = await create2<TransparentUpgradeableProxy__factory>(
                proxyName,
                [implementation.address, proxyAdmin.address, []],
                undefined,
                create2SaltOverrideAlt
            );
        }
        const final = await ethers.getContractAt<C>(contractName, proxy.address, deployer);

        logger.log(`Initializing ${contractName} proxy.`);
        await initialize(final);

        return final;
    };

/**
 * Submits a transaction and waits for it to be mined.
 */
export const setupWaitForTx =
    (logger: ConsoleInterface = console) =>
    async (callTx: () => Promise<ContractTransaction>, msg?: string) => {
        if (msg) {
            logger.log(msg);
        }
        const tx = await callTx();
        process.stdout.write(`Waiting for ${tx.hash}...`);
        await tx.wait();
        // Clear the line
        process.stdout.write(`\x1B[2K\r`);
        logger.log(`Transaction confirmed: ${tx.hash}`);
    };

export const fixNonce = async (hre: HardhatRuntimeEnvironment, nonce: number) => {
    const { getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();

    let tx = await ethers.provider.getSigner().sendTransaction({
        from: deployer,
        to: deployer,
        nonce: nonce,
        value: 0,
        gasPrice: 2000000000,
        gasLimit: 22000,
    });
    await tx.wait();
};

export const randomAddress = (): string => getAddress("0x" + randomBytes(20).toString("hex"));

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {};
func.tags = [];
export default func;
