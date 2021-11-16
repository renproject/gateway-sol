import BigNumber from "bignumber.js";
import chalk from "chalk";
import { BaseContract, ContractTransaction } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { CallOptions, DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    AccessControlEnumerableUpgradeable,
    BasicBridge,
    ERC20PresetMinterPauserUpgradeable,
    GatewayRegistryV2,
    LockGatewayProxyBeaconV1,
    MintGatewayProxyBeaconV1,
    Ownable,
    RenAssetProxyBeaconV1,
    RenProxyAdmin,
    RenVMSignatureVerifierV1,
    TestToken,
    TransparentUpgradeableProxy,
} from "../typechain";
import { NetworkConfig, networks } from "./networks";

const Ox0 = "0x0000000000000000000000000000000000000000";
const CREATE2_DEPLOYER = "0x2222229fb3318a6375fa78fd299a9a42ac6a8fbf";
interface Console {
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
}

const create2Salt = (network: string) => (network.match(/Testnet$/) ? "REN.RC1" : `REN.RC1-${network}`);

const setupGetExistingDeployment =
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

export const setupCreate2 =
    (hre: HardhatRuntimeEnvironment, create2SaltOverride?: string, logger: Console = console) =>
    async <T extends BaseContract>(name: string, args: any[], overrides?: CallOptions): Promise<T> => {
        const { deployments, getNamedAccounts, ethers, network } = hre;
        const { deploy } = deployments;

        const { deployer } = await getNamedAccounts();
        const salt = keccak256(Buffer.from(create2SaltOverride || create2Salt(network.name)));
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
        const contract = await ethers.getContractAt<T>(name, result.address, deployer);

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

const setupDeployProxy =
    (
        hre: HardhatRuntimeEnvironment,
        create2: <T extends BaseContract>(name: string, args: any[]) => Promise<T>,
        proxyAdmin: RenProxyAdmin,
        logger: Console = console
    ) =>
    async <T extends BaseContract>(
        contractName: string,
        proxyName: string,
        initialize: (t: T) => Promise<void>
    ): Promise<T> => {
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
        const implementation: T = await create2<T>(contractName, []);
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
            proxy = await create2(proxyName, [implementation.address, proxyAdmin.address, []]);
        }
        const final = await ethers.getContractAt<T>(contractName, proxy.address, deployer);

        logger.log(`Initializing ${contractName} proxy.`);
        await initialize(final);

        return final;
    };

/**
 * Submits a transaction and waits for it to be mined.
 */
const setupWaitForTx =
    (logger: Console = console) =>
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

export const deployGatewaySol = async function (
    hre: HardhatRuntimeEnvironment,
    config?: NetworkConfig,
    logger: Console = console
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

    const create2 = setupCreate2(hre, create2SaltOverride, logger);
    const getExistingDeployment = setupGetExistingDeployment(hre);
    const waitForTx = setupWaitForTx(logger);

    const { deployer } = await getNamedAccounts();

    // let tx = await ethers.provider.getSigner().sendTransaction({
    //     from: deployer,
    //     to: deployer,
    //     nonce: 174,
    //     value: 0,
    //     gasPrice: 2000000000,
    //     gasLimit: 22000,
    // });
    // await tx.wait();

    logger.log("chainName", chainName);
    logger.log("chainId", chainId);
    logger.log("mintAuthority", mintAuthority);

    // Deploy RenProxyAdmin ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenProxyAdmin"));
    const renProxyAdmin: RenProxyAdmin = await create2<RenProxyAdmin>("RenProxyAdmin", [deployer]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, logger);

    // This should only be false on hardhat.
    const create2IsContract = (await ethers.provider.getCode(CREATE2_DEPLOYER)).replace(/^0x/, "").length > 0;

    // Deploy RenAssetProxyBeacon ////////////////////////////////////////////////
    logger.log(chalk.yellow("RenAsset beacon"));
    const renAssetImplementation = await create2("RenAssetV2", []);
    const existingRenAssetProxyBeacon = await getExistingDeployment<RenAssetProxyBeaconV1>("RenAssetProxyBeaconV1");
    const renAssetProxyBeacon =
        existingRenAssetProxyBeacon ||
        (await create2<RenAssetProxyBeaconV1>("RenAssetProxyBeaconV1", [
            // Temporary value, gets overwritten in the next step. This is to
            // ensure that the address doesn't change between networks even when
            // the implementation changes.
            create2IsContract ? CREATE2_DEPLOYER : renAssetImplementation.address,
            deployer,
        ]));
    if (Ox(await renAssetProxyBeacon.implementation()) !== Ox(renAssetImplementation.address)) {
        logger.log(`Updating RenAsset implementation to ${Ox(renAssetImplementation.address)}`);
        await waitForTx(() => renAssetProxyBeacon.upgradeTo(renAssetImplementation.address));
    }

    // Deploy MintGatewayProxyBeacon /////////////////////////////////////////////
    logger.log(chalk.yellow("MintGateway beacon"));
    const mintGatewayImplementation = await create2("MintGatewayV3", []);
    const existingMintGatewayProxyBeacon = await getExistingDeployment<MintGatewayProxyBeaconV1>(
        "MintGatewayProxyBeaconV1"
    );
    const mintGatewayProxyBeacon =
        existingMintGatewayProxyBeacon ||
        (await create2<MintGatewayProxyBeaconV1>("MintGatewayProxyBeaconV1", [
            // Temporary value, gets overwritten in the next step. This is to
            // ensure that the address doesn't change between networks even when
            // the implementation changes.
            create2IsContract ? CREATE2_DEPLOYER : mintGatewayImplementation.address,
            deployer,
        ]));
    if (Ox(await mintGatewayProxyBeacon.implementation()) !== Ox(mintGatewayImplementation.address)) {
        logger.log(`Updating MintGateway implementation to ${Ox(mintGatewayImplementation.address)}`);
        await waitForTx(() => mintGatewayProxyBeacon.upgradeTo(mintGatewayImplementation.address));
    }

    // Deploy LockGatewayProxyBeacon /////////////////////////////////////////////
    logger.log(chalk.yellow("LockGateway beacon"));
    const lockGatewayImplementation = await create2("LockGatewayV3", []);
    const existingLockGatewayProxyBeacon = await getExistingDeployment<LockGatewayProxyBeaconV1>(
        "LockGatewayProxyBeaconV1"
    );
    const lockGatewayProxyBeacon =
        existingLockGatewayProxyBeacon ||
        (await create2<LockGatewayProxyBeaconV1>("LockGatewayProxyBeaconV1", [
            // Temporary value, gets overwritten in the next step. This is to
            // ensure that the address doesn't change between networks even when
            // the implementation changes.
            create2IsContract ? CREATE2_DEPLOYER : lockGatewayImplementation.address,
            deployer,
        ]));
    if (Ox(await lockGatewayProxyBeacon.implementation()) !== Ox(lockGatewayImplementation.address)) {
        logger.log(`Updating LockGateway implementation to ${Ox(lockGatewayImplementation.address)}`);
        await waitForTx(() => lockGatewayProxyBeacon.upgradeTo(lockGatewayImplementation.address));
    }

    logger.log(chalk.yellow("Signature Verifier"));
    const signatureVerifier = await deployProxy<RenVMSignatureVerifierV1>(
        "RenVMSignatureVerifierV1",
        "RenVMSignatureVerifierProxy",
        async (signatureVerifier) => {
            const currentMintAuthority = Ox(await signatureVerifier.mintAuthority());
            logger.log("currentMintAuthority", currentMintAuthority);
            logger.log("mintAuthority", Ox(mintAuthority));
            if (currentMintAuthority !== Ox(mintAuthority)) {
                await waitForTx(async () => signatureVerifier.__RenVMSignatureVerifier_init(mintAuthority));
            } else {
                logger.log(`Already initialized.`);
            }
        }
    );

    logger.log(chalk.yellow("TransferWithLog"));
    const transferWithLog = await create2("TransferWithLog", []);

    // Deploy GatewayRegistry ////////////////////////////////////////////////////
    logger.log(chalk.yellow("GatewayRegistry"));
    const gatewayRegistry = await deployProxy<GatewayRegistryV2>(
        "GatewayRegistryV2",
        "GatewayRegistryProxy",
        async (gatewayRegistry) => {
            const currentChainName = await gatewayRegistry.chainName();
            if (currentChainName !== chainName) {
                await waitForTx(async () =>
                    gatewayRegistry.__GatewayRegistry_init(
                        chainName,
                        chainId,
                        renAssetProxyBeacon.address,
                        mintGatewayProxyBeacon.address,
                        lockGatewayProxyBeacon.address,
                        deployer,
                        transferWithLog.address
                    )
                );
            } else {
                logger.log(`Already initialized.`);
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
        await waitForTx(async () =>
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
        await waitForTx(async () =>
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
        await waitForTx(async () =>
            renAssetProxyBeacon.grantRole(await renAssetProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...overrides,
            })
        );
    }

    if (
        !(await mintGatewayProxyBeacon.hasRole(await mintGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))
    ) {
        logger.log(`Granting deployer role to gateway registry in mintGatewayProxyBeacon`);
        await waitForTx(async () =>
            mintGatewayProxyBeacon.grantRole(await mintGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...overrides,
            })
        );
    }

    if (
        !(await lockGatewayProxyBeacon.hasRole(await lockGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))
    ) {
        logger.log(`Granting deployer role to gateway registry in lockGatewayProxyBeacon`);
        await waitForTx(async () =>
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
                await waitForTx(() =>
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
                await waitForTx(() =>
                    gatewayRegistry.deployMintGateway(symbol, token, "1", {
                        ...overrides,
                    })
                );
            } else {
                logger.log(`Calling addMintGateway(${symbol}, ${token}, ${gateway})`);
                await waitForTx(() =>
                    gatewayRegistry.addMintGateway(symbol, token, gateway, {
                        ...overrides,
                    })
                );
            }
        } else {
            logger.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
        }
    }

    logger.log(`Handling ${(config.lockGateways || []).length} lock assets.`);
    for (const { symbol, gateway, token, decimals } of config.lockGateways || []) {
        logger.log(chalk.yellow(`Lock asset: ${symbol}`));
        const existingGateway = Ox(await gatewayRegistry.getLockGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getLockAssetBySymbol(symbol));
        const totalSupply = typeof token === "object" ? token.totalSupply : undefined;
        let deployedToken = typeof token === "string" ? token : "";
        if (existingGateway === Ox0) {
            if (!token) {
                logger.log(`Deploying TestToken(${symbol}, ${decimals}, ${totalSupply})`);
                const supply = new BigNumber(
                    totalSupply !== undefined ? totalSupply.replace(/,/g, "") : 1000000
                ).multipliedBy(new BigNumber(10).exponentiatedBy(decimals !== undefined ? decimals : 18));
                const deployedTokenInstance = await create2<TestToken>("TestToken", [
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
                await waitForTx(() =>
                    gatewayRegistry.deployLockGateway(symbol, deployedToken, "1", {
                        ...overrides,
                    })
                );
            } else {
                logger.log(`Calling addLockGateway(${symbol}, ${deployedToken}, ${gateway})`);
                await waitForTx(() =>
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

    const basicBridge = await create2<BasicBridge>("BasicBridge", [gatewayRegistry.address]);

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
