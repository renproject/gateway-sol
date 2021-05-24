/// <reference types="../types/truffle-contracts" />

const NULL = "0x0000000000000000000000000000000000000000";
const NULL1 = "0x0000000000000000000000000000000000000001";

const GatewayRegistry = artifacts.require("GatewayRegistry");

const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");

const MintGatewayLogicV2 = artifacts.require("MintGatewayLogicV2");

const MintGatewayProxy = artifacts.require("MintGatewayProxy");
const RenERC20Proxy = artifacts.require("RenERC20Proxy");

const BasicAdapter = artifacts.require("BasicAdapter");
const RenProxyAdmin = artifacts.require("RenProxyAdmin");

const MintGatewayUpgrader = artifacts.require("MintGatewayUpgrader");

const networks = require("./networks.js");
const { encodeCallData } = require("./encode");
const { sha256, keccak256 } = require("ethereumjs-util");

/**
 * @dev In order to specify what contracts to re-deploy, update `networks.js`.
 *
 * For the network you want to use, set the contracts' addresses to `""` and run:
 * `NETWORK=testnet yarn deploy` (replacing network)
 *
 * Don't forget to verify the contracts on etherscan:
 * `NETWORK=testnet yarn verify DarknodePayment DarknodePaymentStore`
 * (replacing network and contract names)
 *
 * @param {any} deployer
 * @param {string} network
 */
module.exports = async function(deployer, network) {
    return;

    const contractOwner = (await web3.eth.getAccounts())[0];

    const balance = web3.utils.fromWei(
        await web3.eth.getBalance(contractOwner),
        "ether"
    );
    console.log(
        `Deploying from address ${contractOwner.slice(
            0,
            8
        )}... with balance ${balance} ETH`
    );

    const Ox = web3.utils.toChecksumAddress;

    deployer.logger.log(
        `Deploying to ${network} (${network.replace("-fork", "")})...`
    );

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = { ...networks.config, ...networks[network].config };
    console.log(config);
    const mintAuthority = config.mintAuthority || contractOwner;

    // GatewayRegistry.address = addresses.GatewayRegistry || "";
    MintGatewayLogicV2.address = addresses.MintGatewayLogicV2 || "";
    // BasicAdapter.address = addresses.BasicAdapter || "";
    // RenERC20LogicV1.address = addresses.RenERC20LogicV1 || "";
    // RenProxyAdmin.address = addresses.RenProxyAdmin || "";

    let actionCount = 0;

    /** PROXY ADMIN ***********************************************************/
    if (!RenProxyAdmin.address) {
        deployer.logger.log("Deploying Proxy ");
        await deployer.deploy(RenProxyAdmin);
        actionCount++;
    }
    let renProxyAdmin = await RenProxyAdmin.at(RenProxyAdmin.address);

    if (!MintGatewayLogicV2.address) {
        deployer.logger.log(`Deploying MintGatewayLogicV2 logic`);
        await deployer.deploy(MintGatewayLogicV2);
        actionCount++;
    }

    const gatewayLogic = await MintGatewayLogicV2.at(
        MintGatewayLogicV2.address
    );

    // Initialize GatewayLogic so others can't.
    if (Ox(await gatewayLogic.owner()) === Ox(NULL)) {
        deployer.logger.log("Ensuring GatewayLogic is initialized");
        await gatewayLogic.initialize(NULL, NULL1, NULL1, 10000, 10000, 0);
        actionCount++;
    }

    upgrader = await deployer.deploy(
        MintGatewayUpgrader,
        renProxyAdmin.address,
        MintGatewayLogicV2.address,
        mintAuthority
    );

    await renProxyAdmin.transferOwnership(upgrader.address);

    for (const asset of addresses.assets) {
        let { gateway } = asset;
        console.log(gateway, asset);

        const gatewayInstance = await MintGatewayLogicV2.at(gateway);
        await gatewayInstance.transferOwnership(upgrader.address);
        try {
            await upgrader.upgrade(
                gatewayInstance.address,
                expectedSelectorHash
            );
            await gatewayInstance.claimOwnership();
        } catch (error) {
            console.error(error);
        }
    }

    await upgrader.done();
};
