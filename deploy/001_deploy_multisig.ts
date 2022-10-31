import { utils } from "@renproject/utils";
import chalk from "chalk";
import { getAddress as Ox } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ConsoleInterface, setupMultisigTx, updateLogger } from "./deploymentUtils/general";
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

    const multisigTx = await setupMultisigTx(hre, multisig, logger);

    // Check multisig signers and threshold.
    if (multisig && multisig.safeSdk && multisig.getAddress()) {
        const expectedSigners = Array.from<string>(new Set([Ox(deployer), ...config.multisigSigners]).values())
            .map((a) => Ox(a))
            .sort();
        const { signers, threshold } = await multisig.getMultisigRules();

        // Add signers
        for (const expectedSigner of expectedSigners) {
            if (!signers.includes(expectedSigner)) {
                const { to, data } = (
                    await multisig.safeSdk.createAddOwnerTx({
                        ownerAddress: expectedSigner,
                        threshold: config.multisigThreshold,
                    })
                ).data;
                await multisigTx({ to, data }, `Adding signer ${expectedSigner}`);
            }
            await utils.sleep(1 * utils.sleep.SECONDS);
        }

        // Remove signers
        for (const signer of signers) {
            if (!expectedSigners.includes(signer)) {
                const { to, data } = (
                    await multisig.safeSdk.createAddOwnerTx({
                        ownerAddress: signer,
                        threshold: config.multisigThreshold,
                    })
                ).data;
                await multisigTx({ to, data }, `Removing signer ${signer}`);
            }
            await utils.sleep(1 * utils.sleep.SECONDS);
        }

        // Update threshold
        if (config.multisigThreshold !== threshold) {
            const { to, data } = (await multisig.safeSdk.createChangeThresholdTx(config.multisigThreshold)).data;
            await multisigTx({ to, data }, `Updating threshold from ${threshold} to ${config.multisigThreshold}.`);
            await utils.sleep(1 * utils.sleep.SECONDS);
        }

        logger.log(`Signers: ${signers.map((a) => chalk.green(a)).join(", ")}`);
        logger.log(`Threshold: ${chalk.green(threshold)}`);
    }

    logger.groupEnd();
};

export default async function func(env: HardhatRuntimeEnvironment): Promise<void | boolean> {
    await deployProtocol(env);
}

func.tags = ["Multisig"];
