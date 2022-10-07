import BigNumber from "bignumber.js";
import { expect } from "chai";
import hre from "hardhat";

import {
    MigratedMintGateway,
    MigratedMintGateway__factory,
    MintGatewayV3,
    MintGatewayV3__factory,
    RenAssetV2,
} from "../typechain";
import { completeGateway, setupNetworks } from "./utils";

const setup = hre.deployments.createFixture(async () => {
    const { deployments } = hre;

    await deployments.fixture("GatewayRegistryV2");

    return await setupNetworks(hre);
});

describe("Gateway Migration", () => {
    it("migrated gateway", async function () {
        this.timeout(1000 * 1000);

        const { getNamedAccounts, ethers } = hre;
        let { bitcoin, renJS, ethereum, bsc, create2, deployProxy, ethGatewayRegistry, renProxyAdmin } = await setup();
        const { deployer } = await getNamedAccounts();

        ethGatewayRegistry = ethGatewayRegistry.connect(await ethers.getSigner(deployer));

        const renBTC = (
            await ethers.getContractAt<RenAssetV2>("RenAssetV2", await ethereum.getMintAsset("BTC"))
        ).connect(await ethers.getSigner(deployer));
        const existingGateway = (
            await ethers.getContractAt<MintGatewayV3>(
                "MintGatewayV3",
                await ethGatewayRegistry.getMintGatewayBySymbol("BTC")
            )
        ).connect(await ethers.getSigner(deployer));
        const signatureVerifier = await ethGatewayRegistry.getSignatureVerifier();
        const gateway_1 = await deployProxy<MintGatewayV3__factory>(
            "MintGatewayV3",
            "TransparentUpgradeableProxy",
            "MintGatewayV3",
            {
                initializer: "__MintGateway_init",
                constructorArgs: ["BTC", signatureVerifier, renBTC.address] as Parameters<
                    MintGatewayV3["__MintGateway_init"]
                >,
            },
            async (gateway) => {
                try {
                    await gateway.getSelectorHash();
                    return true;
                } catch (error) {
                    return false;
                }
            },
            "gateway_1"
        );

        await existingGateway.transferTokenOwnership(gateway_1.address);
        await ethGatewayRegistry.addMintGateway("BTC", renBTC.address, gateway_1.address);

        expect(await ethGatewayRegistry.getMintGatewayBySymbol("BTC")).to.equal(gateway_1.address);
        expect(await renBTC.owner()).to.equal(gateway_1.address);
        expect(await ethereum.getMintGateway("BTC")).to.equal(gateway_1.address);

        {
            const inAmount = new BigNumber(Math.random() + 1)
                .shiftedBy(bitcoin.assetDecimals(bitcoin.assets.default))
                .integerValue(BigNumber.ROUND_DOWN);

            const mint = await renJS.gateway({
                asset: bitcoin.assets.default,
                from: bitcoin.GatewayAddress(),
                to: ethereum.Account(),
                nonce: 1,
            });
            const outAmount = await mint.fees.estimateOutput(inAmount);

            await completeGateway(mint, inAmount);

            const burn = await renJS.gateway({
                asset: bitcoin.assets.default,
                from: ethereum.Account({ amount: outAmount }),
                to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
            });

            await completeGateway(burn);
        }

        const gateway_2 = await deployProxy<MintGatewayV3__factory>(
            "MintGatewayV3",
            "TransparentUpgradeableProxy",
            "MintGatewayV3",
            {
                initializer: "__MintGateway_init",
                constructorArgs: ["BTC", signatureVerifier, renBTC.address] as Parameters<
                    MintGatewayV3["__MintGateway_init"]
                >,
            },
            async (gateway) => {
                try {
                    await gateway.getSelectorHash();
                    return true;
                } catch (error) {
                    return false;
                }
            },
            "gateway_2"
        );
        await gateway_1.transferTokenOwnership(gateway_2.address);

        // await ethGatewayRegistry.addMintGateway("BTC", renBTC.address, gateway_2.address);

        const migratedMintGateway = await create2<MigratedMintGateway__factory>(
            "MigratedMintGateway",
            [],
            undefined,
            "migratedMintGateway"
        );
        await renProxyAdmin.upgrade(gateway_1.address, migratedMintGateway.address);
        const gateway_1_migrated = await ethers.getContractAt<MigratedMintGateway>(
            "MigratedMintGateway",
            gateway_1.address
        );
        await gateway_1_migrated.setNextGateway(gateway_2.address);
        await gateway_2.updatePreviousGateway(gateway_1_migrated.address);

        {
            const inAmount = new BigNumber(Math.random() + 1)
                .shiftedBy(bitcoin.assetDecimals(bitcoin.assets.default))
                .integerValue(BigNumber.ROUND_DOWN);

            const mint = await renJS.gateway({
                asset: bitcoin.assets.default,
                from: bitcoin.GatewayAddress(),
                to: ethereum.Account(),
                nonce: 2,
            });
            const outAmount = await mint.fees.estimateOutput(inAmount);

            await completeGateway(mint, inAmount);

            const burn = await renJS.gateway({
                asset: bitcoin.assets.default,
                from: ethereum.Account({ amount: outAmount }),
                to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
            });

            await completeGateway(burn);
        }
    });
});
