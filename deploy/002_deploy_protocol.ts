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
import {
    ConsoleInterface,
    setupCreate2,
    setupDeployProxy,
} from "./deploymentUtils";
import { NetworkConfig, networks } from "./networks";

export const deployGatewaySol = async function (
    hre: HardhatRuntimeEnvironment,
    config?: NetworkConfig,
    logger: ConsoleInterface = console
) {
    const { getNamedAccounts, ethers, network } = hre;

    logger.log(`Deploying to ${network.name}...`);

    if (!network.name.match(/^ethereum/) && !network.name.match("hardhat")) {
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

    let governanceAddress: string;
    if (network.name === "hardhat") {
        governanceAddress = deployer;
    } else {
        governanceAddress = renTimelock.address;
    }

    // Deploy RenProxyAdmin ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenProxyAdmin"));
    const renProxyAdmin = await create2<RenProxyAdmin__factory>("RenProxyAdmin", [governanceAddress]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, logger);

    logger.log(chalk.yellow("GetOperatorDarknodes"));
    const getOperatorDarknodes = await create2<GetOperatorDarknodes__factory>("GetOperatorDarknodes", [
        governanceAddress,
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

    logger.log(chalk.yellow("Protocol"));
    const protocol = await create2<Protocol__factory>("Protocol", [renTimelock.address, [deployer]]);
    await protocol.addContract("DarknodeRegistry", darknodeRegistry);
    await protocol.addContract("ClaimRewards", claimRewards.address);
    await protocol.addContract("GetOperatorDarknodes", getOperatorDarknodes.address);

    return {
        protocol,
        claimRewards,
        getOperatorDarknodes,
    };
};

export default async function func(env: HardhatRuntimeEnvironment): Promise<void | boolean> {
    await deployGatewaySol(env);
}

func.tags = ["Protocol", "GetOperatorDarknodes", "ClaimRewards"];
