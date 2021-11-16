import BigNumber from "bignumber.js";
import hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import log from "loglevel";

import {
    BinanceSmartChain,
    Ethereum,
    EvmNetworkConfig,
} from "@renproject/chains-ethereum";
import { MockChain, MockProvider } from "@renproject/mock-provider";
import { RenVMProvider } from "@renproject/provider";
import RenJS, { Gateway, GatewayTransaction } from "@renproject/ren";
import { Ox } from "@renproject/utils";

import {
    deployGatewaySol,
    setupCreate2,
} from "../../deploy/001_deploy_gateways";
import {
    ERC20PresetMinterPauserUpgradeable,
    RenAssetV2,
} from "../../typechain";

export const Ox0 = "0x0000000000000000000000000000000000000000";

export const LocalEthereumNetwork = (
    selector: string,
    symbol: string,
    networkID: number,
    gatewayRegistry: string,
    basicBridge: string
): EvmNetworkConfig => ({
    selector: selector,
    asset: symbol,
    isTestnet: true,

    network: {
        chainId: Ox(networkID),
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

export const completeGateway = async (gateway: Gateway, amount?: BigNumber) => {
    for (const setupKey of Object.keys(gateway.setup)) {
        const setup = gateway.setup[setupKey];
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
    const { ethers, getUnnamedAccounts } = hre;

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

    const usdc = await setupCreate2(
        hre,
        undefined,
        log
    )<ERC20PresetMinterPauserUpgradeable>("ERC20PresetMinterPauserUpgradeable", []);
    await usdc.initialize("USDC", "USDC");
    const usdcDecimals = await usdc.decimals();
    await usdc.mint(user, new BigNumber(100).shiftedBy(usdcDecimals).toFixed());
    await ethGatewayRegistry.deployLockGateway("USDC", usdc.address, "1");
    await bscGatewayRegistry.deployMintGatewayAndRenAsset("USDC", "renUSDC", "renUSDC", usdcDecimals, "1");

    // Set up mock Bitcoin chain.
    const bitcoin = new MockChain("Bitcoin", "BTC");
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
    const ethereum = new Ethereum(ethereumNetwork, {
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
    const bsc = new BinanceSmartChain(bscNetwork, {
        provider: signer.provider as any,
        signer: (await ethers.getSigner(user)) as any,
    });
    mockRenVMProvider.registerChain(bsc);

    renJS.withChains(bitcoin, ethereum, bsc);

    return {
        bitcoin,
        ethereum,
        bsc,
        renJS,
    };
};
