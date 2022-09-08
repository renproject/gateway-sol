import BigNumber from "bignumber.js";
import chalk from "chalk";
import { keccak256 } from "ethers/lib/utils";
import { deployments } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    BasicBridge__factory,
    BeaconProxy__factory,
    ERC20,
    // ForceSend__factory,
    GatewayRegistryV2,
    GatewayRegistryV2__factory,
    LockGatewayProxyBeacon,
    LockGatewayProxyBeacon__factory,
    LockGatewayV3,
    MintGatewayProxyBeacon,
    MintGatewayProxyBeacon__factory,
    MintGatewayV3,
    RenAssetProxyBeacon,
    RenAssetProxyBeacon__factory,
    RenAssetV2,
    RenAssetV2__factory,
    RenProxyAdmin,
    RenProxyAdmin__factory,
    RenTimelock__factory,
    RenVMSignatureVerifierV1,
    RenVMSignatureVerifierV1__factory,
    TestToken__factory,
} from "../typechain";
import {
    ConsoleInterface,
    CREATE2_DEPLOYER,
    getContractAt,
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
    // if (true as boolean) {
    //     return;
    // }
    const { getNamedAccounts, ethers, network } = hre;

    const Ox = ethers.utils.getAddress;

    config = config || networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    const { mintAuthority, chainName, create2SaltOverride } = config;
    const chainId: number = (await ethers.provider.getNetwork()).chainId;
    const { deployer } = await getNamedAccounts();

    logger.log(`Deploying to ${network.name} from ${deployer}...`);

    if (Ox(mintAuthority) === Ox0) {
        throw new Error(`Invalid empty mintAuthority.`);
    }

    const create2 = setupCreate2(hre, create2SaltOverride, logger);
    const getExistingDeployment = setupGetExistingDeployment(hre);
    const waitForTx = setupWaitForTx(logger);

    // const provider = await ethers.getSigner(deployer);
    // const gatewayRegistry2 = GatewayRegistryV2__factory.connect("0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701", provider);
    // console.log("gatewayRegistry2", await gatewayRegistry2!.getMintGatewaySymbols(0, 100));
    // const ibbtc = await gatewayRegistry2?.getMintGatewayBySymbol("ibBTC");
    // console.log(ibbtc);
    // // console.log("renLuna", renLuna);
    // // const forceSend = await ForceSend__factory.connect(renLuna, provider);
    // // console.log(
    // //     await forceSend.send(deployer, {
    // //         gasLimit: 1000000,
    // //     })
    // // );
    // if (true as any) {
    //     throw new Error("done");
    // }

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

    const renProxyAdmin =
        (await getExistingDeployment<RenProxyAdmin>("RenProxyAdmin")) ||
        (await create2<RenProxyAdmin__factory>("RenProxyAdmin", [governanceAddress]));
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, renTimelock, logger);

    // This should only be false on hardhat.
    const create2IsContract = (await ethers.provider.getCode(CREATE2_DEPLOYER)).replace(/^0x/, "").length > 0;

    // Deploy RenAssetProxyBeacon ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenAsset beacon"));
    const renAssetImplementation = await create2<RenAssetV2__factory>("RenAssetV2", []);
    const existingRenAssetProxyBeacon = await getExistingDeployment<RenAssetProxyBeacon>("RenAssetProxyBeacon");
    const renAssetProxyBeacon =
        existingRenAssetProxyBeacon ||
        (await create2<RenAssetProxyBeacon__factory>("RenAssetProxyBeacon", [
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
    const existingMintGatewayProxyBeacon = await getExistingDeployment<MintGatewayProxyBeacon>(
        "MintGatewayProxyBeacon"
    );
    const mintGatewayProxyBeacon =
        existingMintGatewayProxyBeacon ||
        (await create2<MintGatewayProxyBeacon__factory>("MintGatewayProxyBeacon", [
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
    const existingLockGatewayProxyBeacon = await getExistingDeployment<LockGatewayProxyBeacon>(
        "LockGatewayProxyBeacon"
    );
    const lockGatewayProxyBeacon =
        existingLockGatewayProxyBeacon ||
        (await create2<LockGatewayProxyBeacon__factory>("LockGatewayProxyBeacon", [
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
            constructorArgs: [chainName, mintAuthority, governanceAddress] as Parameters<
                RenVMSignatureVerifierV1["__RenVMSignatureVerifier_init"]
            >,
        },
        // isInitialized:
        async (signatureVerifier) => Ox(await signatureVerifier.getMintAuthority()) === Ox(mintAuthority)
    );
    const signatureVerifierOwner = Ox(await signatureVerifier.owner());
    if (signatureVerifierOwner !== Ox(governanceAddress)) {
        logger.log(
            `Transferring RenVMSignatureVerifier ownership to governance address. (Was ${signatureVerifierOwner}, changing to ${Ox(
                governanceAddress
            )}) Deployer: ${deployer}.`
        );
        await waitForTx(signatureVerifier.transferOwnership(governanceAddress));
    }

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
                chainId,
                signatureVerifier.address,
                transferWithLog.address,
                renAssetProxyBeacon.address,
                mintGatewayProxyBeacon.address,
                lockGatewayProxyBeacon.address,
                governanceAddress,
                [deployer],
            ] as Parameters<GatewayRegistryV2["__GatewayRegistry_init"]>,
        },
        async (gatewayRegistry) => {
            try {
                await gatewayRegistry.getSignatureVerifier();
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
        await waitForTx(gatewayRegistry.updateSignatureVerifier(signatureVerifier.address));
    }

    const existingTransferWithLog = Ox(await gatewayRegistry.getTransferContract());
    if (existingTransferWithLog !== Ox(transferWithLog.address)) {
        logger.log(
            `Updating TransferWithLog in gateway registry. Was ${existingTransferWithLog}, updating to ${Ox(
                transferWithLog.address
            )}.`
        );
        await waitForTx(gatewayRegistry.updateTransferContract(transferWithLog.address));
    }

    if (Ox(await gatewayRegistry.getRenAssetProxyBeacon()) !== Ox(renAssetProxyBeacon.address)) {
        throw new Error(`GatewayRegistry's renAssetProxyBeacon address is not correct.`);
    }
    if (Ox(await gatewayRegistry.getMintGatewayProxyBeacon()) !== Ox(mintGatewayProxyBeacon.address)) {
        throw new Error(`GatewayRegistry's mintGatewayProxyBeacon address is not correct.`);
    }
    if (Ox(await gatewayRegistry.getLockGatewayProxyBeacon()) !== Ox(lockGatewayProxyBeacon.address)) {
        throw new Error(`GatewayRegistry's lockGatewayProxyBeacon address is not correct.`);
    }

    if (Ox(await renAssetProxyBeacon.getProxyDeployer()) !== Ox(gatewayRegistry.address)) {
        logger.log(`Granting deployer role to gateway registry in renAssetProxyBeacon.`);
        await waitForTx(renAssetProxyBeacon.updateProxyDeployer(gatewayRegistry.address));
    }
    if ((await renAssetProxyBeacon.owner()) !== governanceAddress) {
        logger.log(`Transferring renAssetProxyBeacon ownership to timelock.`);
        await waitForTx(renAssetProxyBeacon.transferOwnership(governanceAddress));
    }

    if (Ox(await mintGatewayProxyBeacon.getProxyDeployer()) !== Ox(gatewayRegistry.address)) {
        logger.log(`Granting deployer role to gateway registry in mintGatewayProxyBeacon.`);
        await waitForTx(mintGatewayProxyBeacon.updateProxyDeployer(gatewayRegistry.address));
    }
    if ((await mintGatewayProxyBeacon.owner()) !== governanceAddress) {
        logger.log(`Transferring mintGatewayProxyBeacon ownership to timelock.`);
        await waitForTx(mintGatewayProxyBeacon.transferOwnership(governanceAddress));
    }

    if (Ox(await lockGatewayProxyBeacon.getProxyDeployer()) !== Ox(gatewayRegistry.address)) {
        logger.log(`Granting deployer role to gateway registry in lockGatewayProxyBeacon.`);
        await waitForTx(lockGatewayProxyBeacon.updateProxyDeployer(gatewayRegistry.address));
    }
    if ((await lockGatewayProxyBeacon.owner()) !== governanceAddress) {
        logger.log(`Transferring lockGatewayProxyBeacon ownership to timelock.`);
        await waitForTx(lockGatewayProxyBeacon.transferOwnership(governanceAddress));
    }

    logger.log(`Deploying contract verification helper contract.`);
    const beaconProxy = await create2<BeaconProxy__factory>("BeaconProxy", [renAssetProxyBeacon!.address, []]);
    const renAssetProxy = await getContractAt(hre)<RenAssetV2>("RenAssetV2", beaconProxy.address);
    if ((await renAssetProxy.symbol()) === "") {
        logger.log(`Initializing contract verification helper contract.`);
        await waitForTx(renAssetProxy.__RenAsset_init(0, "1", "TESTDEPLOYMENT", "TESTDEPLOYMENT", 0, deployer));
    }
    const beaconDeployment = await deployments.get("BeaconProxy");

    logger.log(`Handling ${(config.mintGateways || []).length} mint assets.`);
    const prefix = config.tokenPrefix;
    for (const { symbol, gateway, token, decimals, version } of config.mintGateways) {
        logger.log(chalk.yellow(`Mint asset: ${symbol}`));
        const existingGateway = Ox(await gatewayRegistry.getMintGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getRenAssetBySymbol(symbol));
        if ((await gatewayRegistry.getGatewayBySymbol(symbol)) === Ox0) {
            const prefixedSymbol = `${prefix}${symbol}`;
            if (!token) {
                logger.log(
                    `Calling deployMintGatewayAndRenAsset(${symbol}, ${prefixedSymbol}, ${prefixedSymbol}, ${decimals}, '${
                        version || "1"
                    }')`
                );
                await waitForTx(
                    gatewayRegistry.deployMintGatewayAndRenAsset(
                        symbol,
                        prefixedSymbol,
                        prefixedSymbol,
                        decimals,
                        version || "1"
                    )
                );
            } else if (!gateway) {
                logger.log(`Calling deployMintGateway(${symbol}, ${token}, '${version || "1"}')`);
                await waitForTx(gatewayRegistry.deployMintGateway(symbol, token, version || "1"));
            } else {
                logger.log(`Calling addMintGateway(${symbol}, ${token}, ${gateway})`);
                await waitForTx(gatewayRegistry.addMintGateway(symbol, token, gateway));
            }
        } else {
            logger.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
        }

        const updatedGateway = existingGateway || Ox(await gatewayRegistry.getMintGatewayBySymbol(symbol));
        const updatedToken = existingToken || Ox(await gatewayRegistry.getRenAssetBySymbol(symbol));

        const gatewayLabel = `ren${symbol}_MintGateway_Proxy`;
        await deployments.save(gatewayLabel, {
            ...beaconDeployment,
            address: updatedGateway,
            metadata:
                beaconDeployment.metadata &&
                beaconDeployment.metadata.replace(/contract BeaconProxy is/g, `contract ${gatewayLabel} is`),
            args: [mintGatewayProxyBeacon.address, []],
        });

        const tokenLabel = `ren${symbol}_Proxy`;
        await deployments.save(tokenLabel, {
            ...beaconDeployment,
            address: updatedToken,
            metadata:
                beaconDeployment.metadata &&
                beaconDeployment.metadata.replace(/contract BeaconProxy is/g, `contract ${tokenLabel} is`),
        });

        try {
            // Update signature verifier.
            const gatewayInstance = await getContractAt(hre)<MintGatewayV3>("MintGatewayV3", updatedGateway);
            const existingSignatureVerifier = Ox(await gatewayInstance.getSignatureVerifier());
            if (existingSignatureVerifier !== Ox(signatureVerifier.address)) {
                logger.log(
                    `Updating signature verifier in the ${symbol} mint gateway. Was ${existingSignatureVerifier}, updating to ${Ox(
                        signatureVerifier.address
                    )}.`
                );
                await waitForTx(gatewayInstance.updateSignatureVerifier(signatureVerifier.address));
            }

            // Update selector hash, by updating symbol.
            const expectedSelectorHash = keccak256(
                Buffer.concat([Buffer.from(symbol), Buffer.from("/to"), Buffer.from(chainName)])
            );
            if (expectedSelectorHash !== (await gatewayInstance.getSelectorHash())) {
                await gatewayInstance.updateAsset(symbol);
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Test Tokens are deployed when a particular lock-asset doesn't exist on a
    // testnet.
    logger.log(`Handling ${(config.lockGateways || []).length} lock assets.`);
    for (const { symbol, gateway, token, decimals, version } of config.lockGateways || []) {
        logger.log(chalk.yellow(`Lock asset: ${symbol}`));
        const existingGateway = Ox(await gatewayRegistry.getLockGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getLockAssetBySymbol(symbol));
        const totalSupply = typeof token === "object" ? token.totalSupply : undefined;
        const tokenSymbol = typeof token === "object" ? token.symbol : undefined;
        let deployedToken = typeof token === "string" ? token : "";
        if (existingGateway === Ox0) {
            // Check token symbol and decimals
            if (token && typeof token === "string") {
                const erc20 = await ethers.getContractAt<ERC20>("ERC20", token);
                const erc20Symbol = await erc20.symbol();
                if (erc20Symbol !== symbol && symbol !== "FTT") {
                    console.error(`Expected ${token.slice(0, 10)}...'s symbol to be ${symbol}, got ${erc20Symbol}`);
                }
                const erc20Decimals = await erc20.decimals();
                if (erc20Decimals !== decimals) {
                    console.error(
                        `Expected ${token.slice(0, 10)}...'s decimals to be ${decimals}, got ${erc20Decimals}`
                    );
                }
            }

            if (typeof token !== "string") {
                logger.log(`Deploying TestToken(${symbol}, ${decimals}, ${totalSupply})`);
                const supply = new BigNumber(
                    totalSupply !== undefined ? totalSupply.replace(/,/g, "") : 1000000
                ).shiftedBy(decimals !== undefined ? decimals : 18);
                const deployedTokenInstance = await create2<TestToken__factory>("TestToken", [
                    tokenSymbol ? tokenSymbol : symbol,
                    tokenSymbol ? tokenSymbol : symbol,
                    decimals,
                    supply.toFixed(),
                    deployer,
                ]);
                deployedToken = deployedTokenInstance.address;
            }

            if (!gateway) {
                logger.log(`Calling deployLockGateway(${symbol}, ${deployedToken}, '${version || "1"}')`);
                await waitForTx(gatewayRegistry.deployLockGateway(symbol, deployedToken, version || "1"));
            } else {
                logger.log(`Calling addLockGateway(${symbol}, ${deployedToken}, ${gateway})`);
                await waitForTx(gatewayRegistry.addLockGateway(symbol, deployedToken, gateway));
            }
        } else {
            logger.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
        }

        const updatedGateway = existingGateway || Ox(await gatewayRegistry.getLockGatewayBySymbol(symbol));
        const gatewayLabel = `ren${symbol}_LockGateway_Proxy`;
        await deployments.save(gatewayLabel, {
            ...beaconDeployment,
            address: updatedGateway,
            metadata: beaconDeployment.metadata && beaconDeployment.metadata.replace("BeaconProxy", gatewayLabel),
            args: [lockGatewayProxyBeacon.address, []],
        });

        try {
            // Update signature verifier.
            const gatewayInstance = await getContractAt(hre)<LockGatewayV3>("LockGatewayV3", updatedGateway);
            const existingSignatureVerifier = Ox(await gatewayInstance.getSignatureVerifier());
            if (existingSignatureVerifier !== Ox(signatureVerifier.address)) {
                logger.log(
                    `Updating signature verifier in the ${symbol} lock gateway. Was ${existingSignatureVerifier}, updating to ${Ox(
                        signatureVerifier.address
                    )}.`
                );
                await waitForTx(gatewayInstance.updateSignatureVerifier(signatureVerifier.address));
            }

            // Update selector hash, by updating symbol.
            const expectedSelectorHash = keccak256(
                Buffer.concat([Buffer.from(symbol), Buffer.from("/to"), Buffer.from(chainName)])
            );
            if (expectedSelectorHash !== (await gatewayInstance.getSelectorHash())) {
                await gatewayInstance.updateAsset(symbol);
            }
        } catch (error) {
            console.error(error);
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
