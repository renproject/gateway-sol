/// <reference types="../types/truffle-contracts" />

const NULL = "0x0000000000000000000000000000000000000000";
const NULL1 = "0x0000000000000000000000000000000000000001";

const GatewayRegistry = artifacts.require("GatewayRegistry");

const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");

const MintGatewayLogicV1 = artifacts.require("MintGatewayLogicV1");

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
    const governanceAddress = config.governanceAddress || contractOwner;
    const feeRecipient = config.feeRecipient || contractOwner;
    const chainName = config.chainName;

    GatewayRegistry.address = addresses.GatewayRegistry || "";
    MintGatewayLogicV1.address = addresses.MintGatewayLogicV1 || "";
    BasicAdapter.address = addresses.BasicAdapter || "";
    RenERC20LogicV1.address = addresses.RenERC20LogicV1 || "";
    RenProxyAdmin.address = addresses.RenProxyAdmin || "";

    const runUpgrade = config.runUpgrade;

    let actionCount = 0;

    /** PROXY ADMIN ***********************************************************/
    if (!RenProxyAdmin.address) {
        deployer.logger.log("Deploying Proxy ");
        await deployer.deploy(RenProxyAdmin);
        actionCount++;
    }
    let renProxyAdmin = await RenProxyAdmin.at(RenProxyAdmin.address);

    /** Registry **************************************************************/

    if (!GatewayRegistry.address) {
        deployer.logger.log(`Deploying Gateway contract`);
        await deployer.deploy(GatewayRegistry);
        actionCount++;
    }
    const registry = await GatewayRegistry.at(GatewayRegistry.address);

    // const protocolGatewayRegistry = await protocol.gatewayRegistry.call();
    // if (Ox(protocolGatewayRegistry) !== Ox(registry.address)) {
    //     deployer.logger.log(`Updating GatewayRegistry in Protocol contract. Was ${protocolGatewayRegistry}, now is ${registry.address}`);
    //     await protocol._updateGatewayRegistry(registry.address);
    //     actionCount++;
    // }

    if (!BasicAdapter.address) {
        deployer.logger.log(`Deploying BasicAdapter`);
        await deployer.deploy(BasicAdapter, registry.address);
        actionCount++;
    }

    if (!RenERC20LogicV1.address) {
        deployer.logger.log(`Deploying RenERC20LogicV1 logic`);
        await deployer.deploy(RenERC20LogicV1);
        actionCount++;
    }
    const renERC20Logic = await RenERC20LogicV1.at(RenERC20LogicV1.address);

    // Initialize RenERC20Logic so others can't.
    if (Ox(await renERC20Logic.owner()) === Ox(NULL)) {
        deployer.logger.log("Ensuring RenERC20Logic is initialized");
        await renERC20Logic.initialize(
            0,
            contractOwner,
            "1000000000000000000",
            "1",
            "",
            "",
            0
        );
        actionCount++;
    }

    if (!MintGatewayLogicV1.address) {
        deployer.logger.log(`Deploying MintGatewayLogicV1 logic`);
        await deployer.deploy(MintGatewayLogicV1);
        actionCount++;
    }
    const gatewayLogic = await MintGatewayLogicV1.at(
        MintGatewayLogicV1.address
    );

    // Initialize GatewayLogic so others can't.
    if (Ox(await gatewayLogic.owner()) === Ox(NULL)) {
        deployer.logger.log("Ensuring GatewayLogic is initialized");
        await gatewayLogic.initialize(NULL, NULL1, NULL1, 10000, 10000, 0);
        actionCount++;
    }

    const chainID = await web3.eth.net.getId();

    for (const asset of addresses.assets) {
        let { symbol, decimals, token, gateway } = asset;
        const prefixedSymbol = `${config.tokenPrefix}${symbol}`;
        deployer.logger.log(
            `Handling ${prefixedSymbol} (decimals: ${decimals}, token: ${token}, gateway: ${gateway})`
        );

        if (!token) {
            deployer.logger.log(`Deploying ${prefixedSymbol} proxy`);
            await deployer.deploy(RenERC20Proxy);
            token = RenERC20Proxy.address;
        }
        const tokenInstance = await RenERC20LogicV1.at(token);
        let tokenInitialized = true;
        try {
            await tokenInstance.symbol.call();
        } catch (error) {
            tokenInitialized = false;
        }

        if (!tokenInitialized) {
            const tokenProxy = await RenERC20Proxy.at(token);
            await tokenProxy.initialize(
                RenERC20LogicV1.address,
                renProxyAdmin.address,
                encodeCallData(
                    web3,
                    "initialize",
                    [
                        "uint256",
                        "address",
                        "uint256",
                        "string",
                        "string",
                        "string",
                        "uint8"
                    ],
                    [
                        chainID,
                        contractOwner,
                        "1000000000000000000",
                        "1",
                        prefixedSymbol,
                        prefixedSymbol,
                        decimals
                    ]
                )
            );
            actionCount++;
        }

        const tokenProxyLogic = await renProxyAdmin.getProxyImplementation(
            token
        );
        if (Ox(tokenProxyLogic) !== Ox(RenERC20LogicV1.address)) {
            deployer.logger.log(
                `${prefixedSymbol} is pointing to out-dated RenERC20Logic.`
            );

            await renProxyAdmin.upgrade(token, RenERC20LogicV1.address);
            actionCount++;
        }

        if (!gateway) {
            deployer.logger.log(`Deploying ${prefixedSymbol} Gateway proxy`);
            await deployer.deploy(MintGatewayProxy);
            gateway = MintGatewayProxy.address;
        }
        const gatewayInstance = await MintGatewayLogicV1.at(gateway);
        let gatewayInitialized = true;
        try {
            // Try to fetch a value.
            await gatewayInstance.token.call();
        } catch (error) {
            gatewayInitialized = false;
        }
        if (!gatewayInitialized) {
            deployer.logger.log(`Initializing ${prefixedSymbol} Gateway proxy`);
            const mintGatewayProxy = await MintGatewayProxy.at(gateway);
            await mintGatewayProxy.initialize(
                MintGatewayLogicV1.address,
                renProxyAdmin.address,
                encodeCallData(
                    web3,
                    "initialize",
                    [
                        "address",
                        "address",
                        "address",
                        "uint16",
                        "uint16",
                        "uint256"
                    ],
                    [
                        token,
                        feeRecipient,
                        mintAuthority,
                        config.mintFee,
                        config.burnFee,
                        0
                    ]
                )
            );
            actionCount++;
        }

        const selector = `${symbol}/to${chainName}`;
        const expectedSelectorHash =
            "0x" +
            keccak256(selector)
                .toString("hex")
                .toLowerCase();

        const MintGatewayProxyLogic = await renProxyAdmin.getProxyImplementation(
            gatewayInstance.address
        );
        if (Ox(MintGatewayProxyLogic) !== Ox(MintGatewayLogicV1.address)) {
            deployer.logger.log(
                `${prefixedSymbol} gateway is pointing to out-dated GatewayLogic.`
            );

            if (runUpgrade) {
                deployer.logger.log(`${prefixedSymbol} - running upgrade.`);
                const upgrader = await deployer.deploy(
                    MintGatewayUpgrader,
                    renProxyAdmin.address,
                    MintGatewayLogicV1.address,
                    mintAuthority
                );
                await gatewayInstance.transferOwnership(upgrader.address);
                await renProxyAdmin.transferOwnership(upgrader.address);
                try {
                    await upgrader.upgrade(
                        gatewayInstance.address,
                        expectedSelectorHash
                    );
                    await gatewayInstance.claimOwnership();
                    await upgrader.done();
                } catch (error) {
                    await upgrader.done();
                    throw error;
                }
            } else {
                await renProxyAdmin.upgrade(
                    gatewayInstance.address,
                    MintGatewayLogicV1.address
                );
                actionCount++;
            }
        }

        const actualSymbol = await tokenInstance.symbol.call();
        if (actualSymbol !== prefixedSymbol) {
            deployer.logger.log(
                `Updating symbol from ${actualSymbol} to ${prefixedSymbol}`
            );
            await gatewayInstance.updateSymbol(prefixedSymbol);
            actionCount++;
        }

        const selectorHash = (
            await gatewayInstance.selectorHash.call()
        ).toLowerCase();
        // const selectorBytes = Buffer.concat([Buffer.from([0, 0, 0, selector.length]), Buffer.from(selector)]);
        // const expectedSelectorHash = "0x" + sha256(selectorBytes).toString("hex").toLowerCase();
        if (selectorHash !== expectedSelectorHash) {
            deployer.logger.log(
                `Updating selector hash from ${selectorHash} to ${expectedSelectorHash}`
            );
            await gatewayInstance.updateSelectorHash(expectedSelectorHash);
            actionCount++;
        }

        const actualMintFee = parseInt(
            (await gatewayInstance.mintFee()).toString(),
            10
        );
        if (actualMintFee !== config.mintFee) {
            deployer.logger.log(
                `Updating mint fee from ${actualMintFee} to ${config.mintFee}`
            );
            await gatewayInstance.updateMintFee(config.mintFee);
            actionCount++;
        }

        const actualBurnFee = parseInt(
            (await gatewayInstance.burnFee()).toString(),
            10
        );
        if (actualBurnFee !== config.burnFee) {
            deployer.logger.log(
                `Updating burn fee from ${actualBurnFee} to ${config.burnFee}`
            );
            await gatewayInstance.updateBurnFee(config.burnFee);
            actionCount++;
        }

        const gatewayMintAuthority = await gatewayInstance.mintAuthority.call();
        if (Ox(gatewayMintAuthority) !== Ox(mintAuthority)) {
            deployer.logger.log(
                `Updating mint authority in ${prefixedSymbol} Gateway. Was ${gatewayMintAuthority}, now is ${mintAuthority}`
            );
            await gatewayInstance.updateMintAuthority(mintAuthority);
            actionCount++;
        }

        const tokenOwner = await tokenInstance.owner.call();
        if (Ox(tokenOwner) !== Ox(gatewayInstance.address)) {
            deployer.logger.log(`Transferring ${prefixedSymbol} ownership`);

            if (Ox(tokenOwner) === Ox(contractOwner)) {
                await tokenInstance.transferOwnership(gatewayInstance.address);

                // Update token's Gateway contract
                deployer.logger.log(
                    `Claiming ${prefixedSymbol} ownership in Gateway`
                );
                await gatewayInstance.claimTokenOwnership();
            } else {
                deployer.logger.log(
                    `Transferring token ownership from ${tokenOwner} to new ${prefixedSymbol} Gateway`
                );
                const oldGateway = await MintGatewayProxy.at(tokenOwner);
                await oldGateway.transferTokenOwnership(
                    gatewayInstance.address
                );
                // This will also call claim, but we try anyway because older
                // contracts didn't:
                try {
                    // Claim ownership
                    await gatewayInstance.claimTokenOwnership();
                } catch (error) {
                    console.error(error);
                }
            }
            actionCount++;
        }

        // let tokenRegistered = (await darknodePayment.registeredTokenIndex.call(Token.address)).toString() !== "0";
        // const pendingRegistration = await darknodePayment.tokenPendingRegistration.call(Token.address);
        // if (!tokenRegistered && !pendingRegistration) {
        //     deployer.logger.log(`Registering token ${symbol} in DarknodePayment`);
        //     await darknodePayment.registerToken(Token.address);
        //     actionCount++;
        // }

        const registered = await registry.getGatewayByToken.call(token);
        if (Ox(registered) === Ox(NULL) || Ox(registered) !== Ox(gateway)) {
            const otherRegistration = await registry.getGatewayBySymbol.call(
                symbol
            );
            const otherToken = await registry.getTokenBySymbol.call(symbol);
            if (Ox(otherRegistration) === Ox(NULL)) {
                deployer.logger.log(`Registering ${prefixedSymbol} Gateway`);
                await registry.setGateway(symbol, token, gateway);
            } else {
                deployer.logger.log(
                    `Updating registered ${prefixedSymbol} Gateway (was ${otherRegistration})`
                );
                if (Ox(token) === Ox(otherToken)) {
                    await registry.updateGateway(token, gateway);
                } else {
                    await registry.removeGateway(symbol);
                    await registry.setGateway(symbol, token, gateway);
                }
            }
            actionCount++;
        }

        const currentFeeRecipient = await gatewayInstance.feeRecipient.call();
        if (Ox(feeRecipient) !== Ox(currentFeeRecipient)) {
            deployer.logger.log(
                `Updating fee recipient for ${prefixedSymbol} Gateway. Was ${Ox(
                    currentFeeRecipient
                )}, now is ${Ox(feeRecipient)}`
            );
            await gatewayInstance.updateFeeRecipient(feeRecipient);
            actionCount++;
        }

        const currentGatewayOwner = await gatewayInstance.owner();
        if (Ox(currentGatewayOwner) !== Ox(governanceAddress)) {
            deployer.logger.log(
                `Transferring ownership of ${prefixedSymbol} Gateway. Was ${Ox(
                    currentGatewayOwner
                )}, now is ${Ox(governanceAddress)}`
            );
            await gatewayInstance.transferOwnership(governanceAddress);
            actionCount++;
        }

        console.log(`
        { // ${prefixedSymbol}
            symbol: "${symbol}",
            decimals: ${decimals},
            token: "${token}",
            gateway: "${gateway}",
        }
        `);
    }

    // Update RenProxyAdmin's owner.
    const currentProxyAdminOwner = await renProxyAdmin.owner();
    if (Ox(currentProxyAdminOwner) !== Ox(governanceAddress)) {
        deployer.logger.log(
            `Transferring ownership of ProxyAdmin. Was ${Ox(
                currentProxyAdminOwner
            )}, now is ${Ox(governanceAddress)}`
        );
        await renProxyAdmin.transferOwnership(governanceAddress);
        actionCount++;
    }

    // Update GatewayRegistry's owner.
    const currentGatewayRegistryOwner = await registry.owner();
    if (Ox(currentGatewayRegistryOwner) !== Ox(governanceAddress)) {
        deployer.logger.log(
            `Transferring ownership of GatewayRegistry. Was ${Ox(
                currentGatewayRegistryOwner
            )}, now is ${Ox(governanceAddress)}`
        );
        await registry.transferOwnership(governanceAddress);
        actionCount++;
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    /** LOG *******************************************************************/

    deployer.logger.log(`
        /* 2_shifter.js */

        GatewayRegistry: "${GatewayRegistry.address}",
        BasicAdapter: "${BasicAdapter.address}",

        RenERC20LogicV1: "${RenERC20LogicV1.address}",
        MintGatewayLogicV1: "${MintGatewayLogicV1.address}",
    `);
};
