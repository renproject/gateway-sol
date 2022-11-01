import BigNumber from "bignumber.js";
import chalk from "chalk";
import { getAddress as Ox } from "ethers/lib/utils";
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
    CREATE2_DEPLOYER,
    getAccountsWithRoles,
    setupCreate2,
    setupDeployProxy,
    setupWaitForTimelockedTx,
    updateLogger,
} from "./deploymentUtils/general";
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
    const { getNamedAccounts, ethers, network } = hre;

    logger.log(chalk.green(`\n\nRunning deployment 003 (Protocol) on ${network.name}...`));

    if (
        !network.name.match(/^ethereumMainnet/) &&
        !network.name.match(/^goerliTestnet/) &&
        !network.name.match("hardhat")
    ) {
        return;
    }

    config = config || networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    const { darknodeRegistry, create2SaltOverride } = config;
    const { deployer } = await getNamedAccounts();
    const { chainId } = await ethers.provider.getNetwork();

    const multisig = await new Multisig(hre, network.name, chainId, logger).load();

    const create2 = setupCreate2(hre, create2SaltOverride, logger);

    // Deploy RenTimelock ////////////////////////////////////////////////
    logger.group("RenTimelock");
    const renTimelock = await create2<RenTimelock__factory>("RenTimelock", [0, [deployer], [deployer]]);

    const waitForTimelockedTx = await setupWaitForTimelockedTx(hre, renTimelock, multisig, logger);

    let governanceAddress: string;
    if (network.name === "hardhat") {
        governanceAddress = deployer;
    } else {
        governanceAddress = renTimelock.address;
    }
    logger.groupEnd();

    // Deploy RenProxyAdmin ////////////////////////////////////////////////
    logger.group("RenProxyAdmin");
    const renProxyAdmin = await create2<RenProxyAdmin__factory>("RenProxyAdmin", [governanceAddress]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, renTimelock, multisig, logger);
    logger.groupEnd();

    logger.group("GetOperatorDarknodes");
    const getOperatorDarknodes = await create2<GetOperatorDarknodes__factory>("GetOperatorDarknodes", [
        darknodeRegistry,
    ]);
    logger.groupEnd();

    // Deploy ClaimRewards ////////////////////////////////////////////////////
    logger.group("ClaimRewards");
    const claimRewards = await deployProxy<ClaimRewardsV1__factory>(
        "ClaimRewardsV1", // should be changed if there's a new version
        "ClaimRewardsProxy",
        "ClaimRewardsV1", // shouldn't be changed if there's a new version
        {
            initializer: "__ClaimRewards_init",
            constructorArgs: [] as Parameters<ClaimRewardsV1["__ClaimRewards_init"]>,
        },
        async (claimRewards) => {
            return new BigNumber(await ethers.provider.getStorageAt(claimRewards.address, 0)).isEqualTo(1);
        }
    );
    logger.groupEnd();

    logger.group("Protocol");
    const protocol = await create2<Protocol__factory>("Protocol", [renTimelock.address, [deployer]]);

    const existingDarknodeRegistry = await protocol.getContract("DarknodeRegistry");
    if (Ox(existingDarknodeRegistry) !== Ox(darknodeRegistry)) {
        await waitForTimelockedTx(
            protocol.populateTransaction.updateContract("DarknodeRegistry", darknodeRegistry),
            `Updating DarknodeRegistry in protocol to ${darknodeRegistry}`
        );
    }

    const existingClaimRewards = await protocol.getContract("ClaimRewards");
    if (Ox(existingClaimRewards) !== Ox(claimRewards.address)) {
        await waitForTimelockedTx(
            protocol.populateTransaction.updateContract("ClaimRewards", claimRewards.address),
            `Updating ClaimRewards in protocol to ${claimRewards.address}`
        );
    }

    const existingGetOperatorDarknodes = await protocol.getContract("GetOperatorDarknodes");
    if (Ox(existingGetOperatorDarknodes) !== Ox(getOperatorDarknodes.address)) {
        await waitForTimelockedTx(
            protocol.populateTransaction.updateContract("GetOperatorDarknodes", getOperatorDarknodes.address),
            `Updating GetOperatorDarknodes in protocol to ${getOperatorDarknodes.address}`
        );
    }

    const knownAccounts = {
        ...(multisig ? { [Ox(multisig.getAddress())]: `multisig (${multisig.getAddress().slice(0, 6)}...)` } : {}),
        [Ox(renTimelock.address)]: `timelock (${renTimelock.address.slice(0, 6)}...)`,
        [Ox(deployer)]: `deployer (${deployer.slice(0, 6)}...)`,
        [Ox(CREATE2_DEPLOYER)]: `create2 (${CREATE2_DEPLOYER.slice(0, 6)}...)`,
    };

    logger.group(`Protocol roles`);
    await getAccountsWithRoles(
        hre,
        protocol,
        knownAccounts,
        ["DEFAULT_ADMIN_ROLE", "CAN_UPDATE_CONTRACTS", "CAN_ADD_CONTRACTS"],
        logger
    );
    logger.groupEnd();

    logger.groupEnd();

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
