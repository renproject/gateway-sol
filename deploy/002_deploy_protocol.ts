import BigNumber from "bignumber.js";
import chalk from "chalk";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    ClaimRewardsV1,
    ClaimRewardsV1__factory,
    GetOperatorDarknodes__factory,
    Protocol__factory,
    RenProxyAdmin__factory,
    RenTimelock__factory,
} from "../typechain";
import { ConsoleInterface, setupCreate2, setupDeployProxy, setupWaitForTimelockedTx, setupWaitForTx } from "./deploymentUtils";
import { NetworkConfig, networks } from "./networks";

export const deployProtocol = async function (
    hre: HardhatRuntimeEnvironment,
    config?: NetworkConfig,
    logger: ConsoleInterface = console
) {
    // if (true as boolean) {
    //     return;
    // }
    const { getNamedAccounts, ethers, network } = hre;

    logger.log(`Deploying to ${network.name}...`);

    if (!network.name.match(/^ethereumMainnet/) && !network.name.match(/^goerliTestnet/) && !network.name.match("hardhat")) {
        return;
    }

    config = config || networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    const { darknodeRegistry, mintAuthority, chainName, create2SaltOverride } = config;
    const { deployer } = await getNamedAccounts();

    const create2 = setupCreate2(hre, create2SaltOverride, logger);
    
    // Deploy RenTimelock ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenTimelock"));
    const renTimelock = await create2<RenTimelock__factory>("RenTimelock", [0, [deployer], [deployer]]);

    const waitForTimelockedTx = setupWaitForTimelockedTx(hre, renTimelock, logger);

    let governanceAddress: string;
    if (network.name === "hardhat") {
        governanceAddress = deployer;
    } else {
        governanceAddress = renTimelock.address;
    }

    // Deploy RenProxyAdmin ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenProxyAdmin"));
    const renProxyAdmin = await create2<RenProxyAdmin__factory>("RenProxyAdmin", [governanceAddress]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, renTimelock, logger);

    logger.log(chalk.yellow("GetOperatorDarknodes"));
    const getOperatorDarknodes = await create2<GetOperatorDarknodes__factory>("GetOperatorDarknodes", [
        darknodeRegistry,
    ]);

    // Deploy ClaimRewards ////////////////////////////////////////////////////
    logger.log(chalk.yellow("ClaimRewards"));
    const claimRewards = await deployProxy<ClaimRewardsV1__factory>(
        "ClaimRewardsV1",
        "ClaimRewardsProxy",
        {
            initializer: "__ClaimRewards_init",
            constructorArgs: [] as Parameters<ClaimRewardsV1["__ClaimRewards_init"]>,
        },
        async (claimRewards) => {
            return new BigNumber(await ethers.provider.getStorageAt(claimRewards.address, 0)).isEqualTo(1);
        }
    );

    const waitForTx = setupWaitForTx(logger);
    const NULL32 = "0x" + "00".repeat(32);

    logger.log(chalk.yellow("Protocol"));
    const protocol = await create2<Protocol__factory>("Protocol", [renTimelock.address, [deployer]]);
    
    await waitForTimelockedTx(
        protocol.populateTransaction.updateContract("DarknodeRegistry", darknodeRegistry),
        `Updating DarknodeRegistry in protocol to ${darknodeRegistry}`
    );
    await waitForTimelockedTx(
        protocol.populateTransaction.updateContract("ClaimRewards", claimRewards.address),
        `Updating ClaimRewards in protocol to ${claimRewards.address}`
    );
    // await protocol.updateContract("DarknodeRegistry", darknodeRegistry);
    // await protocol.updateContract("ClaimRewards", claimRewards.address);
    // const txData = await protocol.populateTransaction.updateContract("ClaimRewards", claimRewards.address);
    // const tx = await renTimelock.schedule(protocol.address, 0, txData.data!, NULL32, NULL32, 0);
    // await waitForTx(tx);

    // const tx2 = await renTimelock.execute(protocol.address, 0, txData.data!, NULL32, NULL32);
    // await waitForTx(tx2);const txData = await protocol.populateTransaction.updateContract("ClaimRewards", claimRewards.address);
    // const tx = await renTimelock.schedule(protocol.address, 0, txData.data!, NULL32, NULL32, 0);
    // await waitForTx(tx);

    // const tx2 = await renTimelock.execute(protocol.address, 0, txData.data!, NULL32, NULL32);
    // await waitForTx(tx2);

    // const txData = await protocol.populateTransaction.updateContract(
    //     "GetOperatorDarknodes",
    //     getOperatorDarknodes.address
    // );
    // const tx = await renTimelock.schedule(protocol.address, 0, txData.data!, NULL32, NULL32, 0);
    // await waitForTx(tx);

    // const tx2 = await renTimelock.execute(protocol.address, 0, txData.data!, NULL32, NULL32);
    // await waitForTx(tx2);

    // await protocol.updateContract("GetOperatorDarknodes", getOperatorDarknodes.address);

    return {
        protocol,
        claimRewards,
        getOperatorDarknodes,
    };
};

export default async function func(env: HardhatRuntimeEnvironment): Promise<void | boolean> {
    await deployProtocol(env);
}

func.tags = ["Protocol", "GetOperatorDarknodes", "ClaimRewards"];
