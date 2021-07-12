import { randomBytes } from "crypto";
import { privateToAddress } from "ethereumjs-util";
import hre from "hardhat";
const ethers = (hre as any).ethers;
import { BasicAdapter__factory, GatewayFactory__factory } from "../typechain";

export const setupLocalNetwork = async () => {
    const [deployer, user] = await ethers.getSigners();

    const mintKey = randomBytes(32);
    const mintAuthority = "0x" + privateToAddress(mintKey).toString("hex");

    // Deploy Gateway Factory.
    const gatewayFactory = await new GatewayFactory__factory(deployer).deploy(
        mintAuthority,
        "Ethereum"
    );
    const gatewayRegistryAddress = await await gatewayFactory.registry();

    // Deploy BTC and ZEC tokens and gateways.
    await gatewayFactory.addToken("Bitcoin", "BTC", 8);
    await gatewayFactory.addToken("Zcash", "ZEC", 8);

    // Deploy BasicAdapter.
    const basicAdapter = await new BasicAdapter__factory(deployer).deploy(
        gatewayRegistryAddress
    );

    // Set up Ethereum network config.
    const providerNetwork = await user.provider?.getNetwork();
    const networkID = providerNetwork ? providerNetwork.chainId : 0;
    const network = LocalEthereumNetwork(
        networkID,
        gatewayRegistryAddress,
        basicAdapter.address
    );

    return {
        network,
        deployer,
        user,
        mintKey,
        mintAuthority,
    };
};

const LocalEthereumNetwork = (
    networkID: number,
    gatewayRegistry: string,
    basicAdapter: string
) => ({
    name: "hardhat",
    chain: "hardhat",
    chainLabel: "Hardhat",
    isTestnet: true,
    networkID,
    infura: "",
    etherscan: "",
    addresses: {
        GatewayRegistry: gatewayRegistry,
        BasicAdapter: basicAdapter,
    },
});

setupLocalNetwork()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
