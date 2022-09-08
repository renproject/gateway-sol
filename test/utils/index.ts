import BigNumber from "bignumber.js";
import { BaseContract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import log from "loglevel";

import { BinanceSmartChain, Ethereum, EVMNetworkConfig } from "@renproject/chains-ethereum";
import { MockChain, MockProvider } from "@renproject/mock-provider";
import { RenVMProvider } from "@renproject/provider";
import RenJS, { Gateway, GatewayTransaction } from "@renproject/ren";
import { utils } from "@renproject/utils";

import { deployGatewaySol } from "../../deploy/001_deploy_gateways";
import {
    setupCreate2,
    setupDeployProxy,
    setupGetExistingDeployment,
    setupWaitForTx,
} from "../../deploy/deploymentUtils";
import {
    ERC20PresetMinterPauserUpgradeable__factory,
    RenProxyAdmin,
    RenProxyAdmin__factory,
    TestToken,
    TestToken__factory,
} from "../../typechain";

export const LocalEthereumNetwork = (
    selector: string,
    symbol: string,
    networkID: number,
    gatewayRegistry: string,
    basicBridge: string
): EVMNetworkConfig => ({
    selector: selector,
    nativeAsset: {
        name: symbol,
        symbol,
        decimals: 18,
    },
    averageConfirmationTime: 1,
    isTestnet: true,

    config: {
        chainId: utils.Ox(networkID),
        chainName: "Hardhat",
        nativeCurrency: { name: "Hardhat Ether", symbol: symbol, decimals: 18 },
        rpcUrls: [""],
        blockExplorerUrls: [""],
    },

    addresses: {
        GatewayRegistry: gatewayRegistry,
        BasicBridge: basicBridge,
    },
});

export const completeGateway = async (gateway: Gateway<any, any>, amount?: BigNumber) => {
    for (const setupKey of Object.keys(gateway.inSetup)) {
        const setup = gateway.inSetup[setupKey];
        if (setup.submit) {
            await setup.submit();
        }
        await setup.wait();
    }

    if (gateway.gatewayAddress && (gateway.fromChain as MockChain).addUTXO) {
        if (!amount) {
            amount = new BigNumber(Math.random() + 1)
                .shiftedBy(await gateway.fromChain.assetDecimals(gateway.fromChain.assets.default))
                .integerValue(BigNumber.ROUND_DOWN);
        }
        (gateway.fromChain as MockChain).addUTXO(gateway.gatewayAddress, amount);
    }

    if (gateway.in) {
        if (gateway.in.submit) {
            await gateway.in.submit();
        }
        await gateway.in.wait(1);
    }

    await new Promise<void>((resolve, reject) => {
        const depositCallback = async (deposit: GatewayTransaction) => {
            try {
                await deposit.in.wait();

                await deposit.renVM.submit();
                await deposit.renVM.wait();

                if (deposit.out.submit) {
                    await deposit.out.submit();
                }
                await deposit.out.wait();

                resolve();
            } catch (error) {
                console.error(error);
                gateway.eventEmitter.removeAllListeners();
                reject(error);
            }
        };
        gateway.on("transaction", depositCallback);
    });
};

export const setupNetworks = async (hre: HardhatRuntimeEnvironment) => {
    const { ethers, getUnnamedAccounts, getNamedAccounts } = hre;

    const { deployer } = await getNamedAccounts();
    const [user] = await getUnnamedAccounts();

    const mockRenVMProvider = new MockProvider();
    const renJS = new RenJS(new RenVMProvider(mockRenVMProvider));
    // Get mint authority from mock provider.
    const mintAuthority = mockRenVMProvider.mintAuthority();

    log.setLevel("ERROR");
    const { gatewayRegistry: ethGatewayRegistry, basicBridge: ethBasicBridge } = await deployGatewaySol(
        hre,
        {
            mintAuthority,
            darknodeRegistry: utils.Ox(Buffer.from(new Array(20))),
            tokenPrefix: "dev",
            chainName: "Ethereum",
            mintGateways: [],
            create2SaltOverride: "eth",
        },
        log
    );
    const { gatewayRegistry: bscGatewayRegistry, basicBridge: bscBasicBridge } = await deployGatewaySol(
        hre,
        {
            mintAuthority,
            darknodeRegistry: utils.Ox(Buffer.from(new Array(20))),
            tokenPrefix: "dev",
            chainName: "BinanceSmartChain",
            mintGateways: [],
            create2SaltOverride: "bsc",
        },
        log
    );

    await ethGatewayRegistry.deployMintGatewayAndRenAsset("BTC", "renBTC", "renBTC", 8, "1");
    await bscGatewayRegistry.deployMintGatewayAndRenAsset("BTC", "renBTC", "renBTC", 8, "1");

    await bscGatewayRegistry.deployMintGatewayAndRenAsset("ETH", "renETH", "renETH", 18, "1");

    const create2 = setupCreate2(hre, undefined, log);
    const getExistingDeployment = setupGetExistingDeployment(hre);
    const waitForTx = setupWaitForTx(log);
    const renProxyAdmin = await create2<RenProxyAdmin__factory>("RenProxyAdmin", [deployer]);
    const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin, log);

    const usdc = await create2<ERC20PresetMinterPauserUpgradeable__factory>("ERC20PresetMinterPauserUpgradeable", []);
    await usdc.initialize("USDC", "USDC");
    const usdcDecimals = await usdc.decimals();
    await usdc.mint(user, new BigNumber(100).shiftedBy(usdcDecimals).toFixed());
    await ethGatewayRegistry.deployLockGateway("USDC", usdc.address, "1");
    await bscGatewayRegistry.deployMintGatewayAndRenAsset("USDC", "renUSDC", "renUSDC", usdcDecimals, "1");

    // Set up mock Bitcoin chain.
    const bitcoin = new MockChain({
        chain: "Bitcoin",
        asset: "BTC",
    });
    mockRenVMProvider.registerChain(bitcoin);

    // Set up Ethereum network config.
    const providerNetwork = await ethers.provider.getNetwork();
    const networkID = providerNetwork ? providerNetwork.chainId : 0;

    const signer = await ethers.getSigner(user);

    const ethereumNetwork = LocalEthereumNetwork(
        "Ethereum",
        "ETH",
        networkID,
        ethGatewayRegistry.address,
        ethBasicBridge.address
    );
    const ethereum = new Ethereum({
        network: ethereumNetwork,
        provider: signer.provider as any,
        signer: (await ethers.getSigner(user)) as any,
    });
    mockRenVMProvider.registerChain(ethereum, ["USDC"]);

    const bscNetwork = LocalEthereumNetwork(
        "BinanceSmartChain",
        "BNB",
        networkID,
        bscGatewayRegistry.address,
        bscBasicBridge.address
    );
    const bsc = new BinanceSmartChain({
        network: bscNetwork,
        provider: signer.provider as any,
        signer: (await ethers.getSigner(user)) as any,
    });
    mockRenVMProvider.registerChain(bsc);

    renJS.withChains(bitcoin, ethereum, bsc);

    return {
        create2,
        deployProxy,
        mockRenVMProvider,
        ethGatewayRegistry,
        renProxyAdmin,
        bitcoin,
        ethereum,
        bsc,
        renJS,
    };
};

export const deployToken = async (hre: HardhatRuntimeEnvironment, symbol: string): Promise<TestToken> => {
    const { getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();

    log.setLevel("ERROR");
    const create2 = setupCreate2(hre, String(Math.random()), log);

    const decimals = 18;
    const supply = new BigNumber(1000000).shiftedBy(18);

    return await create2<TestToken__factory>("TestToken", [symbol, symbol, 18, supply.toFixed(), deployer]);
};

export const getFixture = async <C extends BaseContract>(hre: HardhatRuntimeEnvironment, name: string): Promise<C> => {
    const { deployments, ethers } = hre;
    await deployments.fixture(name);
    const address = (await deployments.get(name)).address;
    return ethers.getContractAt<C>(name, address);
};
