import chalk from "chalk";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ConsoleInterface, updateLogger } from "./deploymentUtils/general";
import { Multisig } from "./deploymentUtils/multisig";
import { NetworkConfig, networks } from "./networks";

export const deployProtocol = async function (
    hre: HardhatRuntimeEnvironment,
    config?: NetworkConfig,
    logger: ConsoleInterface = console
) {
    // if (true as boolean) {
    //     return;
    // }
    logger = updateLogger(logger);

    const { ethers, getNamedAccounts, network } = hre;
    const { deployer } = await getNamedAccounts();

    const { chainId } = await ethers.provider.getNetwork();

    logger.log(chalk.green(`\n\nRunning deployment 001 (MultiSig) on ${network.name}...`));

    config = config || networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    logger.group("MultiSig");
    let multisig: Multisig = new Multisig(hre, network.name, chainId, logger);

    const result = await multisig.load();
    if (multisig.safeSdk) {
        logger.log(`Loaded Multisig at address ${multisig.getAddress()}`);
    }

    if (!result) {
        try {
            logger.log(`Deploying Multisig...`);
            await multisig.deploy([deployer, ...config.multisigSigners], 1);
            if (multisig.safeSdk) {
                logger.log(`Deployed Multisig at address ${multisig.getAddress()}`);
            }
        } catch (error) {
            console.error(error);
            logger.log(`Unable to load Multisig.`);
        }
    }

    logger.groupEnd();
};

export default async function func(env: HardhatRuntimeEnvironment): Promise<void | boolean> {
    await deployProtocol(env);
}

func.tags = ["Multisig"];
