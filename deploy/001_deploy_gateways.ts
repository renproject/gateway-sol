import BigNumber from "bignumber.js";
import chalk from "chalk";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    BasicBridge__factory,
    GatewayRegistryV2,
    GatewayRegistryV2__factory,
    LockGatewayProxyBeaconV1,
    LockGatewayProxyBeaconV1__factory,
    MintGatewayProxyBeaconV1,
    MintGatewayProxyBeaconV1__factory,
    RenAssetProxyBeaconV1,
    RenAssetProxyBeaconV1__factory,
    RenAssetV2__factory,
    RenProxyAdmin,
    RenProxyAdmin__factory,
    RenVMSignatureVerifierV1,
    RenVMSignatureVerifierV1__factory,
    TestToken__factory,
} from "../typechain";
import {
    ConsoleInterface,
    CREATE2_DEPLOYER,
    Ox0,
    setupCreate2,
    setupDeployProxy,
    setupGetExistingDeployment,
    setupWaitForTx,
} from "./deploymentUtils";
import { NetworkConfig, networks } from "./networks";

export const deployGatewaySol = async function (
    hre: HardhatRuntimeEnvironment,
    config?: NetworkConfig,
    logger: ConsoleInterface = console
) {
    const { getNamedAccounts, ethers, network } = hre;

    logger.log(`Deploying to ${network.name}...`);

    const Ox = ethers.utils.getAddress;

    config = config || networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    const { mintAuthority, chainName, create2SaltOverride, overrides } = config;
    const chainId: number = (await ethers.provider.getNetwork()).chainId;
    const { deployer } = await getNamedAccounts();

    const create2 = setupCreate2(hre, create2SaltOverride, logger);
    const getExistingDeployment = setupGetExistingDeployment(hre);
    const waitForTx = setupWaitForTx(logger);

    // Deploy RenProxyAdmin ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenProxyAdmin"));
    const renProxyAdmin: RenProxyAdmin = await create2<RenProxyAdmin__factory>("RenProxyAdmin", [deployer]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, logger);

    // This should only be false on hardhat.
    const create2IsContract = (await ethers.provider.getCode(CREATE2_DEPLOYER)).replace(/^0x/, "").length > 0;

    // Deploy RenAssetProxyBeacon ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenAsset beacon"));
    const renAssetImplementation = await create2<RenAssetV2__factory>("RenAssetV2", []);
    const existingRenAssetProxyBeacon = await getExistingDeployment<RenAssetProxyBeaconV1>("RenAssetProxyBeaconV1");
    const renAssetProxyBeacon =
        existingRenAssetProxyBeacon ||
        (await create2<RenAssetProxyBeaconV1__factory>("RenAssetProxyBeaconV1", [
            // Temporary value, gets overwritten in the next step. This is to
            // ensure that the address doesn't change between networks even when
            // the implementation changes.
            create2IsContract ? CREATE2_DEPLOYER : renAssetImplementation.address,
            deployer,
        ]));
    if (Ox(await renAssetProxyBeacon.implementation()) !== Ox(renAssetImplementation.address)) {
        logger.log(`Updating RenAsset implementation to ${Ox(renAssetImplementation.address)}`);
        await waitForTx(renAssetProxyBeacon.upgradeTo(renAssetImplementation.address));
    }

    // Deploy MintGatewayProxyBeacon /////////////////////////////////////////////
    logger.log(chalk.yellow("MintGateway beacon"));
    const mintGatewayImplementation = await create2("MintGatewayV3", []);
    const existingMintGatewayProxyBeacon = await getExistingDeployment<MintGatewayProxyBeaconV1>(
        "MintGatewayProxyBeaconV1"
    );
    const mintGatewayProxyBeacon =
        existingMintGatewayProxyBeacon ||
        (await create2<MintGatewayProxyBeaconV1__factory>("MintGatewayProxyBeaconV1", [
            // Temporary value, gets overwritten in the next step. This is to
            // ensure that the address doesn't change between networks even when
            // the implementation changes.
            create2IsContract ? CREATE2_DEPLOYER : mintGatewayImplementation.address,
            deployer,
        ]));
    if (Ox(await mintGatewayProxyBeacon.implementation()) !== Ox(mintGatewayImplementation.address)) {
        logger.log(`Updating MintGateway implementation to ${Ox(mintGatewayImplementation.address)}`);
        await waitForTx(mintGatewayProxyBeacon.upgradeTo(mintGatewayImplementation.address));
    }

    // Deploy LockGatewayProxyBeacon /////////////////////////////////////////////
    logger.log(chalk.yellow("LockGateway beacon"));
    const lockGatewayImplementation = await create2("LockGatewayV3", []);
    const existingLockGatewayProxyBeacon = await getExistingDeployment<LockGatewayProxyBeaconV1>(
        "LockGatewayProxyBeaconV1"
    );
    const lockGatewayProxyBeacon =
        existingLockGatewayProxyBeacon ||
        (await create2<LockGatewayProxyBeaconV1__factory>("LockGatewayProxyBeaconV1", [
            // Temporary value, gets overwritten in the next step. This is to
            // ensure that the address doesn't change between networks even when
            // the implementation changes.
            create2IsContract ? CREATE2_DEPLOYER : lockGatewayImplementation.address,
            deployer,
        ]));
    if (Ox(await lockGatewayProxyBeacon.implementation()) !== Ox(lockGatewayImplementation.address)) {
        logger.log(`Updating LockGateway implementation to ${Ox(lockGatewayImplementation.address)}`);
        await waitForTx(lockGatewayProxyBeacon.upgradeTo(lockGatewayImplementation.address));
    }

    logger.log(chalk.yellow("Signature Verifier"));
    const signatureVerifier = await deployProxy<RenVMSignatureVerifierV1__factory>(
        "RenVMSignatureVerifierV1",
        "RenVMSignatureVerifierProxy",
        {
            initializer: "__RenVMSignatureVerifier_init",
            constructorArgs: [mintAuthority, deployer] as Parameters<
                RenVMSignatureVerifierV1["__RenVMSignatureVerifier_init"]
            >,
        },
        async (signatureVerifier) => {
            const currentMintAuthority = Ox(await signatureVerifier.mintAuthority());
            logger.log("currentMintAuthority", currentMintAuthority);
            logger.log("mintAuthority", Ox(mintAuthority));
            if (currentMintAuthority !== Ox(mintAuthority)) {
                return false;
            } else {
                return true;
            }
        }
    );

    logger.log(chalk.yellow("TransferWithLog"));
    const transferWithLog = await create2("TransferWithLog", []);

    // Deploy GatewayRegistry ////////////////////////////////////////////////////
    logger.log(chalk.yellow("GatewayRegistry"));
    const gatewayRegistry = await deployProxy<GatewayRegistryV2__factory>(
        "GatewayRegistryV2",
        "GatewayRegistryProxy",
        {
            initializer: "__GatewayRegistry_init",
            constructorArgs: [
                chainName,
                chainId,
                deployer,
                signatureVerifier.address,
                transferWithLog.address,
                renAssetProxyBeacon.address,
                mintGatewayProxyBeacon.address,
                lockGatewayProxyBeacon.address,
            ] as Parameters<GatewayRegistryV2["__GatewayRegistry_init"]>,
        },
        async (gatewayRegistry) => {
            try {
                await gatewayRegistry.chainName();
                return true;
            } catch (error: any) {
                return false;
            }
        }
    );
    const existingSignatureVerifier = Ox(await gatewayRegistry.getSignatureVerifier());
    if (existingSignatureVerifier !== Ox(signatureVerifier.address)) {
        logger.log(
            `Updating signature verifier in gateway registry. Was ${existingSignatureVerifier}, updating to ${Ox(
                signatureVerifier.address
            )}.`
        );
        await waitForTx(
            gatewayRegistry.updateSignatureVerifier(signatureVerifier.address, {
                ...overrides,
            })
        );
    }

    const existingTransferWithLog = Ox(await gatewayRegistry.getTransferWithLog());
    if (existingTransferWithLog !== Ox(transferWithLog.address)) {
        logger.log(
            `Updating TransferWithLog in gateway registry. Was ${existingTransferWithLog}, updating to ${Ox(
                transferWithLog.address
            )}.`
        );
        await waitForTx(
            gatewayRegistry.updateTransferWithLog(transferWithLog.address, {
                ...overrides,
            })
        );
    }

    if (Ox(await gatewayRegistry.renAssetProxyBeacon()) !== Ox(renAssetProxyBeacon.address)) {
        throw new Error(`GatewayRegistry's renAssetProxyBeacon address is not correct.`);
    }
    if (Ox(await gatewayRegistry.mintGatewayProxyBeacon()) !== Ox(mintGatewayProxyBeacon.address)) {
        throw new Error(`GatewayRegistry's mintGatewayProxyBeacon address is not correct.`);
    }
    if (Ox(await gatewayRegistry.lockGatewayProxyBeacon()) !== Ox(lockGatewayProxyBeacon.address)) {
        throw new Error(`GatewayRegistry's lockGatewayProxyBeacon address is not correct.`);
    }

    if (!(await renAssetProxyBeacon.hasRole(await renAssetProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))) {
        logger.log(`Granting deployer role to gateway registry in renAssetProxyBeacon`);
        await waitForTx(
            renAssetProxyBeacon.grantRole(await renAssetProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...overrides,
            })
        );
    }

    if (
        !(await mintGatewayProxyBeacon.hasRole(await mintGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))
    ) {
        logger.log(`Granting deployer role to gateway registry in mintGatewayProxyBeacon`);
        await waitForTx(
            mintGatewayProxyBeacon.grantRole(await mintGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...overrides,
            })
        );
    }

    if (
        !(await lockGatewayProxyBeacon.hasRole(await lockGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))
    ) {
        logger.log(`Granting deployer role to gateway registry in lockGatewayProxyBeacon`);
        await waitForTx(
            lockGatewayProxyBeacon.grantRole(await lockGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...overrides,
            })
        );
    }

    logger.log(`Handling ${(config.mintGateways || []).length} mint assets.`);
    const prefix = config.tokenPrefix;
    for (const { symbol, gateway, token, decimals } of config.mintGateways) {
        logger.log(chalk.yellow(`Mint asset: ${symbol}`));
        const existingGateway = Ox(await gatewayRegistry.getMintGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getRenAssetBySymbol(symbol));
        if ((await gatewayRegistry.getGatewayBySymbol(symbol)) === Ox0) {
            const prefixedSymbol = `${prefix}${symbol}`;
            if (!token) {
                logger.log(
                    `Calling deployMintGatewayAndRenAsset(${symbol}, ${prefixedSymbol}, ${prefixedSymbol}, ${decimals}, '1')`
                );
                await waitForTx(
                    gatewayRegistry.deployMintGatewayAndRenAsset(
                        symbol,
                        prefixedSymbol,
                        prefixedSymbol,
                        decimals,
                        "1",
                        {
                            ...overrides,
                        }
                    )
                );
            } else if (!gateway) {
                logger.log(`Calling deployMintGateway(${symbol}, ${token}, '1')`);
                await waitForTx(
                    gatewayRegistry.deployMintGateway(symbol, token, "1", {
                        ...overrides,
                    })
                );
            } else {
                logger.log(`Calling addMintGateway(${symbol}, ${token}, ${gateway})`);
                await waitForTx(
                    gatewayRegistry.addMintGateway(symbol, token, gateway, {
                        ...overrides,
                    })
                );
            }
        } else {
            logger.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
        }
    }

    // Test Tokens are deployed when a particular lock-asset doesn't exist on a
    // testnet.
    logger.log(`Handling ${(config.lockGateways || []).length} lock assets.`);
    for (const { symbol, gateway, token, decimals } of config.lockGateways || []) {
        logger.log(chalk.yellow(`Lock asset: ${symbol}`));
        const existingGateway = Ox(await gatewayRegistry.getLockGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getLockAssetBySymbol(symbol));
        const totalSupply = typeof token === "object" ? token.totalSupply : undefined;
        let deployedToken = typeof token === "string" ? token : "";
        if (existingGateway === Ox0) {
            if (typeof token !== "string") {
                logger.log(`Deploying TestToken(${symbol}, ${decimals}, ${totalSupply})`);
                const supply = new BigNumber(
                    totalSupply !== undefined ? totalSupply.replace(/,/g, "") : 1000000
                ).shiftedBy(decimals !== undefined ? decimals : 18);
                const deployedTokenInstance = await create2<TestToken__factory>("TestToken", [
                    symbol,
                    symbol,
                    decimals,
                    supply.toFixed(),
                    deployer,
                ]);
                deployedToken = deployedTokenInstance.address;
            }

            if (!gateway) {
                logger.log(`Calling deployLockGateway(${symbol}, ${deployedToken}, '1')`);
                await waitForTx(
                    gatewayRegistry.deployLockGateway(symbol, deployedToken, "1", {
                        ...overrides,
                    })
                );
            } else {
                logger.log(`Calling addLockGateway(${symbol}, ${deployedToken}, ${gateway})`);
                await waitForTx(
                    gatewayRegistry.addLockGateway(symbol, deployedToken, gateway, {
                        ...overrides,
                    })
                );
            }
        } else {
            logger.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
        }
    }

    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'BTC',
    //   'renBTC',
    //   'renBTC',
    //   8,
    //   '1'
    // );
    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'ZEC',
    //   'renZEC',
    //   'renZEC',
    //   8,
    //   '1'
    // );
    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'BCH',
    //   'renBCH',
    //   'renBCH',
    //   8,
    //   '1'
    // );
    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'DGB',
    //   'renDGB',
    //   'renDGB',
    //   8,
    //   '1'
    // );
    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'FIL',
    //   'renFIL',
    //   'renFIL',
    //   18,
    //   '1'
    // );
    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'LUNA',
    //   'renLUNA',
    //   'renLUNA',
    //   6,
    //   '1'
    // );
    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'DOGE',
    //   'renDOGE',
    //   'renDOGE',
    //   8,
    //   '1'
    // );

    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'ETH',
    //   'renETH',
    //   'renETH',
    //   18,
    //   '1'
    // );

    // await gatewayRegistry.deployMintGatewayAndRenAsset(
    //   'DAI',
    //   'renDAI',
    //   'renDAI',
    //   18,
    //   '1'
    // );

    // await usdc.initialize('USDC', 'USDC');
    // await gatewayRegistry.deployLockGateway('DAI', usdc.address, '1');

    // await usdc.mint(deployer, '100', {from: deployer});

    // const usdcLockGatewayAddress = await gatewayRegistry.getLockGatewayBySymbol(
    //   'USDC'
    // );
    // const usdcGateway = await ethers.getContractAt<LockGatewayV3>(
    //   'LockGatewayV3',
    //   usdcLockGatewayAddress,
    //   deployer
    // );

    // await usdc.approve(usdcGateway.address, '10', {from: deployer});
    // await usdcGateway.lock('8123', 'Bitcoin', [], '10', {from: deployer});

    logger.log("mint gateway symbols:", await gatewayRegistry.getMintGatewaySymbols(0, 0));
    const lockSymbols = await gatewayRegistry.getLockGatewaySymbols(0, 0);
    logger.log("lock gateway symbols:", lockSymbols);
    for (const lockSymbol of lockSymbols) {
        const lockToken = await gatewayRegistry.getLockAssetBySymbol(lockSymbol);
        logger.log(`${lockSymbol}: ${lockToken}`);
    }

    const basicBridge = await create2<BasicBridge__factory>("BasicBridge", [gatewayRegistry.address]);

    return {
        gatewayRegistry,
        basicBridge,
        signatureVerifier,
    };
};

export default async function func(env: HardhatRuntimeEnvironment): Promise<void | boolean> {
    await deployGatewaySol(env);
}

func.tags = [
    "RenAssetV2",
    "RenAssetProxyBeacon",
    "MintGatewayV3",
    "MintGatewayProxyBeacon",
    "LockGatewayV3",
    "LockGatewayProxyBeacon",
    "RenVMSignatureVerifierV1",
    "RenVMSignatureVerifierProxy",
    "GatewayRegistryV2",
    "BasicBridge",
    "ERC20PresetMinterPauserUpgradeable",
];
