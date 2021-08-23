import { keccak256 } from "ethereumjs-util";
import { ethers } from "hardhat";
import { toChecksumAddress } from "web3-utils";

import chalk from "chalk";
import {
    BasicAdapter,
    BasicAdapter__factory,
    GatewayRegistry,
    GatewayRegistry__factory,
    MintGatewayLogicV2,
    MintGatewayLogicV2__factory,
    MintGatewayProxy__factory,
    RenERC20LogicV1,
    RenERC20LogicV1__factory,
    RenERC20Proxy__factory,
    RenProxyAdmin,
    RenProxyAdmin__factory,
} from "../typechain";
import { encodeCallData } from "./encode";
import { networks } from "./networks";
import { at, deploy, printDeployerInfo, sleep } from "./utils";

const NULL = "0x0000000000000000000000000000000000000000";
const NULL1 = "0x0000000000000000000000000000000000000001";

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
export async function deployGateways() {
    const [contractOwner] = await ethers.getSigners();

    const Ox = toChecksumAddress;

    const network = process.env.HARDHAT_NETWORK;

    console.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    const addresses = networks[network as "hardhat"];
    if (!addresses) {
        return;
    }

    const config = { ...networks.config, ...addresses.config };
    console.log(config);
    const mintAuthority = config.mintAuthority || contractOwner.address;
    const governanceAddress = config.governanceAddress || contractOwner.address;
    const feeRecipient = config.feeRecipient || contractOwner.address;
    const chainName = config.chainName;

    let actionCount = 0;

    /* PROXY ADMIN ************************************************************/
    let renProxyAdmin: RenProxyAdmin;
    if (!addresses.RenProxyAdmin) {
        console.log("Deploying RenProxyAdmin");
        renProxyAdmin = await deploy<RenProxyAdmin__factory>("RenProxyAdmin");
        actionCount++;
    } else {
        renProxyAdmin = await at<RenProxyAdmin__factory>(
            "RenProxyAdmin",
            addresses.RenProxyAdmin
        );
    }
    // const renProxyAdmin = await RenProxyAdmin.at(RenProxyAdmin.address);

    /* Registry ***************************************************************/

    let registry: GatewayRegistry;
    if (!addresses.GatewayRegistry) {
        console.log(`Deploying Gateway Registry contract`);
        registry = await deploy<GatewayRegistry__factory>("GatewayRegistry");
        actionCount++;
    } else {
        registry = await at<GatewayRegistry__factory>(
            "GatewayRegistry",
            addresses.GatewayRegistry
        );
    }

    // const protocolGatewayRegistry = await protocol.gatewayRegistry();
    // if (Ox(protocolGatewayRegistry) !== Ox(registry.address)) {
    //     console.log(`Updating GatewayRegistry in Protocol contract. Was ${protocolGatewayRegistry}, now is ${registry.address}`);
    //     await protocol._updateGatewayRegistry(registry.address);
    //     actionCount++;
    // }

    let basicAdapter: BasicAdapter;
    if (!addresses.BasicAdapter) {
        console.log(`Deploying BasicAdapter`);
        basicAdapter = await deploy<BasicAdapter__factory>(
            "BasicAdapter",
            registry.address
        );
        actionCount++;
    } else {
        basicAdapter = await at<BasicAdapter__factory>(
            "BasicAdapter",
            addresses.BasicAdapter
        );
    }

    let renERC20Logic: RenERC20LogicV1;
    if (!addresses.RenERC20LogicV1) {
        console.log(`Deploying RenERC20LogicV1 logic`);
        renERC20Logic = await deploy<RenERC20LogicV1__factory>(
            "RenERC20LogicV1"
        );
        actionCount++;
    } else {
        renERC20Logic = await at<RenERC20LogicV1__factory>(
            "RenERC20LogicV1",
            addresses.RenERC20LogicV1
        );
    }

    // Initialize RenERC20Logic so others can't.
    if (Ox(await renERC20Logic.owner()) === Ox(NULL)) {
        console.log("Ensuring RenERC20Logic is initialized");
        await (
            await renERC20Logic[
                "initialize(uint256,address,uint256,string,string,string,uint8)"
            ](0, contractOwner.address, "1000000000000000000", "1", "", "", 0)
        ).wait();
        actionCount++;
    }

    let gatewayLogic: MintGatewayLogicV2;
    if (!addresses.MintGatewayLogicV2) {
        console.log(`Deploying MintGatewayLogicV2 logic`);
        gatewayLogic = await deploy<MintGatewayLogicV2__factory>(
            "MintGatewayLogicV2"
        );
        actionCount++;
    } else {
        gatewayLogic = await at<MintGatewayLogicV2__factory>(
            "MintGatewayLogicV2",
            addresses.MintGatewayLogicV2
        );
    }

    // Initialize GatewayLogic so others can't.
    if (Ox(await gatewayLogic.owner()) === Ox(NULL)) {
        console.log("Ensuring GatewayLogic is initialized");
        await (
            await gatewayLogic[
                "initialize(address,address,address,uint16,uint16,uint256)"
            ](NULL, NULL1, NULL1, 10000, 10000, 0)
        ).wait();
        actionCount++;
    }

    /* LOG ********************************************************************/

    console.log(`
        RenProxyAdmin: "${renProxyAdmin.address}",

        GatewayRegistry: "${registry.address}",
        BasicAdapter: "${basicAdapter.address}",
        GenericAdapter: "",

        RenERC20LogicV1: "${renERC20Logic.address}",
        MintGatewayLogicV2: "${gatewayLogic.address}",
    `);

    const chainID = (await ethers.provider.getNetwork()).chainId;

    for (const asset of addresses.assets || []) {
        const { symbol, decimals } = asset;
        let { token, gateway } = asset;
        const prefixedSymbol = `${config.tokenPrefix}${symbol}`;
        console.log(
            `Handling ${prefixedSymbol} (decimals: ${decimals}, token: ${token}, gateway: ${gateway})`
        );

        if (!token) {
            console.log(`Deploying ${prefixedSymbol} proxy`);
            const proxy = await deploy<RenERC20Proxy__factory>("RenERC20Proxy");
            token = proxy.address;
        }
        const tokenInstance = await at<RenERC20LogicV1__factory>(
            "RenERC20LogicV1",
            token
        );
        let tokenInitialized = true;
        try {
            await tokenInstance.symbol();
        } catch (error) {
            tokenInitialized = false;
        }

        if (!tokenInitialized) {
            console.log(`Initializing ${prefixedSymbol} proxy`);
            const tokenProxy = await at<RenERC20Proxy__factory>(
                "RenERC20Proxy",
                token
            );
            await (
                await tokenProxy["initialize(address,address,bytes)"](
                    renERC20Logic.address,
                    renProxyAdmin.address,
                    encodeCallData(
                        "initialize",
                        [
                            "uint256",
                            "address",
                            "uint256",
                            "string",
                            "string",
                            "string",
                            "uint8",
                        ],
                        [
                            chainID,
                            contractOwner.address,
                            "1000000000000000000",
                            "1",
                            prefixedSymbol,
                            prefixedSymbol,
                            decimals,
                        ]
                    )
                )
            ).wait();
            await sleep(1 * 1000);
            actionCount++;
        }

        const tokenProxyLogic = await renProxyAdmin.getProxyImplementation(
            token
        );
        if (Ox(tokenProxyLogic) !== Ox(renERC20Logic.address)) {
            console.log(
                `${prefixedSymbol} is pointing to out-dated RenERC20Logic.`
            );

            await (
                await renProxyAdmin.upgrade(token, renERC20Logic.address)
            ).wait();
            actionCount++;
        }

        if (!gateway) {
            console.log(`Deploying ${prefixedSymbol} Gateway proxy`);
            const proxy = await deploy<MintGatewayProxy__factory>(
                "MintGatewayProxy"
            );
            gateway = proxy.address;
        }
        const gatewayInstance = await at<MintGatewayLogicV2__factory>(
            "MintGatewayLogicV2",
            gateway
        );

        let gatewayInitialized = true;
        try {
            // Try to fetch a value.
            await gatewayInstance.token();
        } catch (error) {
            gatewayInitialized = false;
        }
        if (!gatewayInitialized) {
            console.log(`Initializing ${prefixedSymbol} Gateway proxy`);
            const mintGatewayProxy = await at<MintGatewayProxy__factory>(
                "MintGatewayProxy",
                gateway
            );
            await (
                await mintGatewayProxy["initialize(address,address,bytes)"](
                    gatewayLogic.address,
                    renProxyAdmin.address,
                    encodeCallData(
                        "initialize",
                        [
                            "address",
                            "address",
                            "address",
                            "uint16",
                            "uint16",
                            "uint256",
                        ],
                        [
                            token,
                            feeRecipient,
                            mintAuthority,
                            config.mintFee,
                            config.burnFee,
                            0,
                        ]
                    )
                    // {
                    //     gasLimit: 8000000,
                    //     gasPrice: 6 * 1e9,
                    // }
                )
            ).wait();
            await sleep(1 * 1000);
            actionCount++;
        }

        const selector = `${symbol}/to${chainName}`;
        const expectedSelectorHash =
            "0x" +
            keccak256(Buffer.from(selector)).toString("hex").toLowerCase();

        const MintGatewayProxyLogic =
            await renProxyAdmin.getProxyImplementation(gatewayInstance.address);
        if (Ox(MintGatewayProxyLogic) !== Ox(gatewayLogic.address)) {
            console.log(
                `${prefixedSymbol} gateway is pointing to out-dated GatewayLogic.`
            );

            await (
                await renProxyAdmin.upgrade(
                    gatewayInstance.address,
                    gatewayLogic.address
                )
            ).wait();
            actionCount++;
        }

        // const actualSymbol = await tokenInstance.symbol();
        // if (actualSymbol !== prefixedSymbol) {
        //     console.log(
        //         `Updating symbol from ${actualSymbol} to ${prefixedSymbol}`
        //     );
        //     await gatewayInstance.updateSymbol(prefixedSymbol);
        //     actionCount++;
        // }

        const selectorHash = (
            await gatewayInstance.selectorHash()
        ).toLowerCase();
        // const selectorBytes = Buffer.concat([Buffer.from([0, 0, 0, selector.length]), Buffer.from(selector)]);
        // const expectedSelectorHash = "0x" + sha256(selectorBytes).toString("hex").toLowerCase();
        if (selectorHash !== expectedSelectorHash) {
            console.log(
                `Updating selector hash from ${selectorHash} to ${expectedSelectorHash} (${selector})`
            );
            await (
                await gatewayInstance.updateSelectorHash(expectedSelectorHash)
            ).wait();
            actionCount++;
        }

        const actualMintFee = parseInt(
            (await gatewayInstance.mintFee()).toString(),
            10
        );
        if (actualMintFee !== config.mintFee) {
            console.log(
                `Updating mint fee from ${actualMintFee} to ${config.mintFee}`
            );
            await (await gatewayInstance.updateMintFee(config.mintFee)).wait();
            actionCount++;
        }

        const actualBurnFee = parseInt(
            (await gatewayInstance.burnFee()).toString(),
            10
        );
        if (actualBurnFee !== config.burnFee) {
            console.log(
                `Updating burn fee from ${actualBurnFee} to ${config.burnFee}`
            );
            await (await gatewayInstance.updateBurnFee(config.burnFee)).wait();
            actionCount++;
        }

        const gatewayMintAuthority = await gatewayInstance.mintAuthority();
        if (Ox(gatewayMintAuthority) !== Ox(mintAuthority)) {
            console.log(
                `Updating mint authority in ${prefixedSymbol} Gateway. Was ${gatewayMintAuthority}, now is ${mintAuthority}`
            );
            await (
                await gatewayInstance.updateMintAuthority(mintAuthority)
            ).wait();
            actionCount++;
        }

        const tokenOwner = await tokenInstance.owner();
        const pendingOwner = await tokenInstance.pendingOwner();
        if (Ox(tokenOwner) !== Ox(gatewayInstance.address)) {
            if (Ox(tokenOwner) === Ox(contractOwner.address)) {
                if (Ox(pendingOwner) !== Ox(gatewayInstance.address)) {
                    console.log(`Transferring ${prefixedSymbol} ownership`);
                    await (
                        await tokenInstance.transferOwnership(
                            gatewayInstance.address,
                            {
                                gasLimit: 8000000,
                                gasPrice: 6 * 1e9,
                            }
                        )
                    ).wait();
                }

                // Update token's Gateway contract
                console.log(`Claiming ${prefixedSymbol} ownership in Gateway`);
                await (await gatewayInstance.claimTokenOwnership()).wait();
            } else {
                console.log(
                    `Transferring token ownership from ${tokenOwner} to new ${prefixedSymbol} Gateway`
                );
                const oldGateway = await at<MintGatewayLogicV2__factory>(
                    "MintGatewayLogicV2",
                    tokenOwner
                );
                await (
                    await oldGateway.transferTokenOwnership(
                        gatewayInstance.address
                    )
                ).wait();
                // This will also call claim, but we try anyway because older
                // contracts didn't:
                try {
                    // Claim ownership
                    await (await gatewayInstance.claimTokenOwnership()).wait();
                } catch (error) {
                    console.error(error);
                }
            }
            actionCount++;
        }

        // let tokenRegistered = (await darknodePayment.registeredTokenIndex(Token.address)).toString() !== "0";
        // const pendingRegistration = await darknodePayment.tokenPendingRegistration(Token.address);
        // if (!tokenRegistered && !pendingRegistration) {
        //     console.log(`Registering token ${symbol} in DarknodePayment`);
        //     await darknodePayment.registerToken(Token.address);
        //     actionCount++;
        // }

        const registered = await registry.getGatewayByToken(token);
        if (Ox(registered) === Ox(NULL) || Ox(registered) !== Ox(gateway)) {
            const otherRegistration = await registry.getGatewayBySymbol(symbol);
            const otherToken = await registry.getTokenBySymbol(symbol);
            if (Ox(otherRegistration) === Ox(NULL)) {
                console.log(`Registering ${prefixedSymbol} Gateway`);
                await (
                    await registry.setGateway(symbol, token, gateway)
                ).wait();
            } else {
                console.log(
                    `Updating registered ${prefixedSymbol} Gateway (was ${otherRegistration})`
                );
                if (Ox(token) === Ox(otherToken)) {
                    await (await registry.updateGateway(token, gateway)).wait();
                } else {
                    await (await registry.removeGateway(symbol)).wait();
                    await (
                        await registry.setGateway(symbol, token, gateway)
                    ).wait();
                }
            }
            actionCount++;
        }

        // const currentFeeRecipient = await gatewayInstance.feeRecipient();
        // if (Ox(feeRecipient) !== Ox(currentFeeRecipient)) {
        //     console.log(
        //         `Updating fee recipient for ${prefixedSymbol} Gateway. Was ${Ox(
        //             currentFeeRecipient
        //         )}, now is ${Ox(feeRecipient)}`
        //     );
        //     await gatewayInstance.updateFeeRecipient(feeRecipient);
        //     actionCount++;
        // }

        const currentGatewayOwner = await gatewayInstance.owner();
        const pendingGatewayOwner = await gatewayInstance.pendingOwner();
        if (
            Ox(currentGatewayOwner) !== Ox(governanceAddress) &&
            Ox(pendingGatewayOwner) !== Ox(governanceAddress)
        ) {
            console.log(
                `Transferring ownership of ${prefixedSymbol} Gateway. Was ${Ox(
                    currentGatewayOwner
                )}, now is ${Ox(governanceAddress)}`
            );
            await (
                await gatewayInstance._directTransferOwnership(
                    governanceAddress
                )
            ).wait();
            actionCount++;
        } else if (Ox(pendingGatewayOwner) === Ox(governanceAddress)) {
            try {
                console.log(
                    `Direct transferring ownership of ${prefixedSymbol} Gateway. Was ${Ox(
                        currentGatewayOwner
                    )}, now is ${Ox(governanceAddress)}`
                );
                await (
                    await gatewayInstance._directTransferOwnership(
                        governanceAddress
                    )
                ).wait();
                actionCount++;
            } catch (error) {
                console.log(
                    chalk.bgYellow(
                        `Note - ${prefixedSymbol} Gateway ownership hasn't been claimed yet.`
                    )
                );
            }
        }

        console.log(`
        {
            // ${prefixedSymbol}
            symbol: "${symbol}",
            decimals: ${decimals},
            token: "${token}",
            gateway: "${gateway}",
        },
        `);
    }

    // Update RenProxyAdmin's owner.
    const currentProxyAdminOwner = await renProxyAdmin.owner();
    if (Ox(currentProxyAdminOwner) !== Ox(governanceAddress)) {
        console.log(
            `Transferring ownership of ProxyAdmin. Was ${Ox(
                currentProxyAdminOwner
            )}, now is ${Ox(governanceAddress)}`
        );
        await (await renProxyAdmin.transferOwnership(governanceAddress)).wait();
        actionCount++;
    }

    // Update GatewayRegistry's owner.
    const currentGatewayRegistryOwner = await registry.owner();
    const pendingGatewayRegistryOwner = await registry.pendingOwner();
    if (
        Ox(currentGatewayRegistryOwner) !== Ox(governanceAddress) &&
        Ox(pendingGatewayRegistryOwner) !== Ox(governanceAddress)
    ) {
        console.log(
            `Transferring ownership of GatewayRegistry. Was ${Ox(
                currentGatewayRegistryOwner
            )}, now is ${Ox(governanceAddress)}`
        );
        await (
            await registry._directTransferOwnership(governanceAddress)
        ).wait();
        actionCount++;
    } else if (Ox(pendingGatewayRegistryOwner) !== Ox(governanceAddress)) {
        try {
            console.log(
                `Direct transferring ownership of GatewayRegistry. Was ${Ox(
                    currentGatewayRegistryOwner
                )}, now is ${Ox(governanceAddress)}`
            );
            await (
                await registry._directTransferOwnership(governanceAddress)
            ).wait();
            actionCount++;
        } catch (error) {
            console.log(
                chalk.bgYellow(
                    `Note - GatewayRegistry ownership hasn't been claimed yet.`
                )
            );
        }
    }

    console.log(`Performed ${actionCount} updates.`);
}

if (require.main === module) {
    printDeployerInfo()
        .then(async () => {
            await deployGateways();
            process.exit(0);
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
