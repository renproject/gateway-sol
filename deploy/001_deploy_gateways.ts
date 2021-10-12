import BigNumber from "bignumber.js";
import { BaseContract, ContractTransaction } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { CallOptions, DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    AccessControlEnumerableUpgradeable,
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
import { networks } from "./networks";

const Ox0 = "0x0000000000000000000000000000000000000000";
const CREATE2_DEPLOYER = "0x2222229fb3318a6375fa78fd299a9a42ac6a8fbf";

const create2SaltMsg = (network: string) => (network.match(/Testnet$/) ? "REN.RC1" : `REN.RC1-${network}`);
const create2Salt = (network: string) => keccak256(Buffer.from(create2SaltMsg(network)));

const setupGetExistingDeployment =
    (hre: HardhatRuntimeEnvironment) =>
    async <T extends BaseContract>(name: string): Promise<T | null> => {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { getOrNull } = deployments;

        const { deployer } = await getNamedAccounts();
        const result = await getOrNull(name);

        return result ? await ethers.getContractAt<T>(name, result.address, deployer) : result;
    };

const setupCreate2 =
    (hre: HardhatRuntimeEnvironment, overrides?: CallOptions) =>
    async <T extends BaseContract>(name: string, args: any[]): Promise<T> => {
        const { deployments, getNamedAccounts, ethers, network } = hre;
        const { deploy } = deployments;

        const { deployer } = await getNamedAccounts();
        const salt = create2Salt(network.name);
        console.log(`Deploying ${name} from ${deployer} (salt: keccak256(${create2SaltMsg(network.name)}))`);

        const result = await deploy(name, {
            from: deployer,
            args: args,
            log: true,
            deterministicDeployment: salt,
            skipIfAlreadyDeployed: true,
            ...overrides,
        });
        console.log(`Deployed ${name} at ${result.address}.`);
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
        proxyAdmin: RenProxyAdmin
    ) =>
    async <T extends BaseContract>(
        contractName: string,
        proxyName: string,
        initialize: (t: T) => Promise<void>
    ): Promise<T> => {
        const { deployments, getNamedAccounts, ethers } = hre;

        const { deployer } = await getNamedAccounts();

        const existingImplementationDeployment = (await deployments.getOrNull(contractName)) as unknown as T;
        let implementation: T;
        if (existingImplementationDeployment) {
            console.log(`Reusing ${contractName} at ${existingImplementationDeployment.address}`);

            implementation = await ethers.getContractAt<T>(
                contractName,
                existingImplementationDeployment.address,
                deployer
            );
        } else {
            implementation = await create2<T>(contractName, []);
        }

        console.log(`Initializing ${contractName} instance (optional).`);
        await initialize(implementation);

        const existingProxyDeployment = (await deployments.getOrNull(proxyName)) as unknown as BaseContract;
        let proxy: TransparentUpgradeableProxy;
        if (existingProxyDeployment) {
            console.log(`Reusing ${proxyName} at ${existingProxyDeployment.address}`);
            proxy = await ethers.getContractAt<TransparentUpgradeableProxy>(
                proxyName,
                existingProxyDeployment.address,
                deployer
            );
            const currentImplementation = await proxyAdmin.getProxyImplementation(proxy.address);
            console.log(proxyName, "points to", currentImplementation);
            if (currentImplementation.toLowerCase() !== implementation.address.toLowerCase()) {
                console.log(
                    `Updating ${proxyName} to point to ${implementation.address} instead of ${currentImplementation}`
                );
                await waitForTx(async () => proxyAdmin.upgrade(proxy.address, implementation.address));
            }
        } else {
            proxy = await create2(proxyName, [implementation.address, proxyAdmin.address, []]);
        }
        const final = await ethers.getContractAt<T>(contractName, proxy.address, deployer);

        console.log(`Initializing ${contractName} proxy.`);
        await initialize(final);

        return final;
    };

/**
 * Submits a transaction and waits for it to be mined.
 */
const waitForTx = async (callTx: () => Promise<ContractTransaction>, msg?: string) => {
    if (msg) {
        console.log(msg);
    }
    const tx = await callTx();
    process.stdout.write(`Waiting for ${tx.hash}...`);
    await tx.wait();
    // Clear the line
    process.stdout.write(`\x1B[2K\r`);
    console.log(`Transaction confirmed: ${tx.hash}`);
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, ethers, network } = hre;

    console.log(`Deploying to ${network.name}...`);

    const Ox = ethers.utils.getAddress;

    const config = networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    const create2 = setupCreate2(hre);
    const getExistingDeployment = setupGetExistingDeployment(hre);

    const { deployer } = await getNamedAccounts();

    const chainName = config.chainName;
    const chainId: number = (await ethers.provider.getNetwork()).chainId;
    const mintAuthority = config.mintAuthority;

    console.log("chainName", chainName);
    console.log("chainId", chainId);
    console.log("mintAuthority", mintAuthority);

    // Deploy RenProxyAdmin ////////////////////////////////////////////////
    const renProxyAdmin: RenProxyAdmin = await create2<RenProxyAdmin>("RenProxyAdmin", [deployer]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin);

    // Deploy RenAssetProxyBeacon ////////////////////////////////////////////////
    const renAssetImplementation = await create2("RenAssetV2", []);
    const existingRenAssetProxyBeacon = await getExistingDeployment<RenAssetProxyBeaconV1>("RenAssetProxyBeaconV1");
    const renAssetProxyBeacon =
        existingRenAssetProxyBeacon ||
        (await create2<RenAssetProxyBeaconV1>("RenAssetProxyBeaconV1", [
            CREATE2_DEPLOYER, // Temporary value, gets overwritten in the next step.
            deployer,
        ]));
    if (Ox(await renAssetProxyBeacon.implementation()) !== Ox(renAssetImplementation.address)) {
        await waitForTx(() => renAssetProxyBeacon.upgradeTo(renAssetImplementation.address));
    }

    // Deploy MintGatewayProxyBeacon /////////////////////////////////////////////
    const mintGatewayImplementation = await create2("MintGatewayV3", []);
    const existingsMintGatewayProxyBeacon = await getExistingDeployment<MintGatewayProxyBeaconV1>(
        "MintGatewayProxyBeaconV1"
    );
    const mintGatewayProxyBeacon =
        existingsMintGatewayProxyBeacon ||
        (await create2<MintGatewayProxyBeaconV1>("MintGatewayProxyBeaconV1", [
            CREATE2_DEPLOYER, // Temporary value, gets overwritten in the next step.
            deployer,
        ]));
    if (Ox(await mintGatewayProxyBeacon.implementation()) !== Ox(mintGatewayImplementation.address)) {
        await waitForTx(() => mintGatewayProxyBeacon.upgradeTo(mintGatewayImplementation.address));
    }

    // Deploy LockGatewayProxyBeacon /////////////////////////////////////////////
    const lockGatewayImplementation = await create2("LockGatewayV3", []);
    const existingsLockGatewayProxyBeacon = await getExistingDeployment<LockGatewayProxyBeaconV1>(
        "LockGatewayProxyBeaconV1"
    );
    const lockGatewayProxyBeacon =
        existingsLockGatewayProxyBeacon ||
        (await create2<LockGatewayProxyBeaconV1>("LockGatewayProxyBeaconV1", [
            CREATE2_DEPLOYER, // Temporary value, gets overwritten in the next step.
            deployer,
        ]));
    if (Ox(await lockGatewayProxyBeacon.implementation()) !== Ox(lockGatewayImplementation.address)) {
        await waitForTx(() => lockGatewayProxyBeacon.upgradeTo(lockGatewayImplementation.address));
    }

    const signatureVerifier = await deployProxy<RenVMSignatureVerifierV1>(
        "RenVMSignatureVerifierV1",
        "RenVMSignatureVerifierProxy",
        async (signatureVerifier) => {
            const currentMintAuthority = Ox(await signatureVerifier.mintAuthority());
            console.log("currentMintAuthority", currentMintAuthority);
            console.log("mintAuthority", Ox(mintAuthority));
            if (currentMintAuthority !== Ox(mintAuthority)) {
                await waitForTx(async () => signatureVerifier.__RenVMSignatureVerifier_init(mintAuthority));
            } else {
                console.log(`Already initialized.`);
            }
        }
    );

    // Deploy GatewayRegistry ////////////////////////////////////////////////////
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
                        deployer
                    )
                );
            } else {
                console.log(`Already initialized.`);
            }
        }
    );
    const existingSignatureVerifier = Ox(await gatewayRegistry.signatureVerifier());
    if (existingSignatureVerifier !== Ox(signatureVerifier.address)) {
        console.log(
            `Updating signature verifier in gateway registry. Was ${existingSignatureVerifier}, updating to ${Ox(
                signatureVerifier.address
            )}.`
        );
        await waitForTx(async () =>
            gatewayRegistry.updateSignatureVerifier(signatureVerifier.address, {
                ...config.overrides,
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
        console.log(`Granting deployer role to gateway registry in renAssetProxyBeacon`);
        await waitForTx(async () =>
            renAssetProxyBeacon.grantRole(await renAssetProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...config.overrides,
            })
        );
    }

    if (
        !(await mintGatewayProxyBeacon.hasRole(await mintGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))
    ) {
        console.log(`Granting deployer role to gateway registry in mintGatewayProxyBeacon`);
        await waitForTx(async () =>
            mintGatewayProxyBeacon.grantRole(await mintGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...config.overrides,
            })
        );
    }

    if (
        !(await lockGatewayProxyBeacon.hasRole(await lockGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address))
    ) {
        console.log(`Granting deployer role to gateway registry in lockGatewayProxyBeacon`);
        await waitForTx(async () =>
            lockGatewayProxyBeacon.grantRole(await lockGatewayProxyBeacon.PROXY_DEPLOYER(), gatewayRegistry.address, {
                ...config.overrides,
            })
        );
    }

    const prefix = config.tokenPrefix;
    for (const { symbol, gateway, token, decimals } of config.mintGateways) {
        const existingGateway = Ox(await gatewayRegistry.getMintGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getRenAssetBySymbol(symbol));
        if ((await gatewayRegistry.getGatewayBySymbol(symbol)) === Ox0) {
            const prefixedSymbol = `${prefix}${symbol}`;
            if (!token) {
                console.log(
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
                            ...config.overrides,
                        }
                    )
                );
            } else {
                console.log(`Calling addMintGateway(${symbol}, ${token}, ${gateway})`);
                await waitForTx(() =>
                    gatewayRegistry.addMintGateway(symbol, token, gateway, {
                        ...config.overrides,
                    })
                );
            }
        } else {
            console.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
        }
    }

    for (const { symbol, gateway, token, decimals, totalSupply } of config.lockGateways || []) {
        const existingGateway = Ox(await gatewayRegistry.getLockGatewayBySymbol(symbol));
        const existingToken = Ox(await gatewayRegistry.getLockAssetBySymbol(symbol));
        let deployedToken = token;
        if (existingGateway === Ox0) {
            if (!token) {
                console.log(`Deploying TestToken(${symbol}, ${decimals}, ${totalSupply})`);
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
                console.log(`Calling deployLockGateway(${symbol}, ${deployedToken}, '1')`);
                await waitForTx(() =>
                    gatewayRegistry.deployLockGateway(symbol, deployedToken, "1", {
                        ...config.overrides,
                    })
                );
            } else {
                console.log(`Calling addLockGateway(${symbol}, ${deployedToken}, ${gateway})`);
                await waitForTx(() =>
                    gatewayRegistry.addLockGateway(symbol, deployedToken, gateway, {
                        ...config.overrides,
                    })
                );
            }
        } else {
            console.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
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

    // const usdc = await create2<ERC20PresetMinterPauserUpgradeable>(
    //   'ERC20PresetMinterPauserUpgradeable',
    //   []
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

    console.log("mint gateway symbols:", await gatewayRegistry.getMintGatewaySymbols(0, 0));
    const lockSymbols = await gatewayRegistry.getLockGatewaySymbols(0, 0);
    console.log("lock gateway symbols:", lockSymbols);
    for (const lockSymbol of lockSymbols) {
        const lockToken = await gatewayRegistry.getLockAssetBySymbol(lockSymbol);
        console.log(`${lockSymbol}: ${lockToken}`);
    }

    await create2("BasicBridge", [gatewayRegistry.address]);
};

export default func;

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
