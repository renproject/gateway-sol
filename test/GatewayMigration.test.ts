import { utils } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { expect } from "chai";
import { Signer } from "ethers";
import { defaultAbiCoder, keccak256 } from "ethers/lib/utils";
import hre from "hardhat";

import { Ox0, Ox1 } from "../deploy/deploymentUtils/general";
import {
    LegacyMintGatewayLogicV2,
    LegacyMintGatewayLogicV2__factory,
    LegacyRenERC20LogicV2__factory,
    MintGatewayV3,
    MintGatewayV3__factory,
    RenVMSignatureVerifierV1,
} from "../typechain";
import { MintGatewayForwarder__factory } from "../typechain/factories/MintGatewayForwarder__factory";
import { MintGatewayForwarder } from "../typechain/MintGatewayForwarder";
import { completeGateway, setupNetworks } from "./utils";

const setup = hre.deployments.createFixture(async () => {
    const { deployments } = hre;

    await deployments.fixture("GatewayRegistryV2");

    return await setupNetworks(hre);
});

const getTxError = async (signer: Signer, tx: any) => {
    // Try to fetch the revert reason of the transaction.
    const result = await signer.call(tx);
    // 0x08c379a0
    const errorSignature = utils.Ox(utils.keccak256(utils.fromUTF8String("Error(string)")).slice(0, 4));
    if (
        // Check if the result signature matches the errorSignature.
        result.slice(0, 10) === errorSignature
    ) {
        const errorMessage: string = defaultAbiCoder.decode(
            ["string"],
            Buffer.from(result.slice(errorSignature.length), "hex")
        )[0];
        return errorMessage;
    }
    if (result === "0x") {
        return "Transaction may fail";
    }
    return undefined;
};

describe("Gateway Migration", () => {
    it("migrated gateway", async function () {
        this.timeout(1000 * 1000);

        const { getNamedAccounts, getUnnamedAccounts, ethers } = hre;
        let { bitcoin, renJS, ethereum, bsc, create2, deployProxy, ethGatewayRegistry, renProxyAdmin } = await setup();
        const { deployer } = await getNamedAccounts();
        const [user] = await getUnnamedAccounts();

        const signer = await ethers.getSigner(deployer);
        const userSigner = await ethers.getSigner(user);

        ethGatewayRegistry = ethGatewayRegistry.connect(signer);
        const renBTC = await deployProxy<LegacyRenERC20LogicV2__factory>(
            "Legacy_RenERC20LogicV2",
            "TransparentUpgradeableProxy",
            "Legacy_RenERC20LogicV2",
            {
                initializer: "initialize(uint256,address,string,string,string,uint8)",
                constructorArgs: [1, deployer, "1", "renBTC", "renBTC", 8],
            },
            async (token) => {
                return (await token.symbol()) === "renBTC";
            },
            "renBTC"
        );
        // const existingGateway = (
        //     await ethers.getContractAt<MintGatewayV3>(
        //         "MintGatewayV3",
        //         await ethGatewayRegistry.getMintGatewayBySymbol("BTC")
        //     )
        // ).connect(signer);
        const signatureVerifier = await ethers.getContractAt<RenVMSignatureVerifierV1>(
            "RenVMSignatureVerifierV1",
            await ethGatewayRegistry.getSignatureVerifier(),
            deployer
        );
        const mintAuthority = await signatureVerifier.getMintAuthority();

        let gateway_2: MintGatewayV3;
        let gateway_1_migrated: MintGatewayForwarder;
        let mint1: any | undefined;
        {
            const gateway_1 = await deployProxy<LegacyMintGatewayLogicV2__factory>(
                "Legacy_MintGatewayLogicV2",
                "TransparentUpgradeableProxy",
                "Legacy_MintGatewayLogicV2",
                {
                    initializer: "initialize(address,address,address,uint16,uint16,uint256)",
                    constructorArgs: [renBTC.address, Ox1, mintAuthority, 0, 0, 0] as Parameters<
                        LegacyMintGatewayLogicV2["initialize(address,address,address,uint16,uint16,uint256)"]
                    >,
                },
                async (gateway) => (await gateway.token()) !== Ox0,
                "gateway_1"
            );

            await renBTC.transferOwnership(gateway_1.address);
            await gateway_1.claimTokenOwnership();

            await gateway_1.updateSelectorHash(keccak256(Buffer.from(`BTC/toEthereum`)));

            // await existingGateway.transferTokenOwnership(gateway_1.address);
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

                mint1 = await completeGateway(mint, inAmount);
                await utils.sleep(0.1 * utils.sleep.SECONDS);

                expect(await getTxError(userSigner, mint1)).to.equal(
                    "MintGateway: nonce hash already spent",
                    "Resubmitting mint #1"
                );

                const burn = await renJS.gateway({
                    asset: bitcoin.assets.default,
                    from: ethereum.Account({ amount: outAmount }),
                    to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
                });

                await completeGateway(burn);
            }

            gateway_2 = await deployProxy<MintGatewayV3__factory>(
                "MintGatewayV3",
                "TransparentUpgradeableProxy",
                "MintGatewayV3",
                {
                    initializer: "__MintGateway_init",
                    constructorArgs: ["BTC", signatureVerifier.address, renBTC.address] as Parameters<
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

            gateway_1_migrated = await deployProxy<MintGatewayForwarder__factory>(
                "MintGatewayForwarder",
                "TransparentUpgradeableProxy",
                "Legacy_MintGatewayLogicV2",
                {
                    initializer: "initialize(address,address,address,uint16,uint16,uint256)",
                    constructorArgs: [renBTC.address, Ox0, mintAuthority, 0, 0, 0] as Parameters<
                        LegacyMintGatewayLogicV2["initialize(address,address,address,uint16,uint16,uint256)"]
                    >,
                },
                async (gateway) => (await gateway.token()) !== Ox0,
                "gateway_1"
            );

            if (gateway_1.address !== gateway_1_migrated.address) {
                throw new Error(`Expected gateway proxy address not to change.`);
            }

            await gateway_1_migrated.updateNextGateway(gateway_2.address);
            await gateway_2.updatePreviousGateway(gateway_1_migrated.address);
        }

        // Test minting and burning using old gateway pointing to new gateway.
        let mint2;
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

            mint2 = await completeGateway(mint, inAmount);
            await utils.sleep(0.1 * utils.sleep.SECONDS);

            expect(await getTxError(userSigner, mint2)).to.equal(
                "MintGateway: signature already spent",
                "Resubmitting mint #2"
            );

            const burn = await renJS.gateway({
                asset: bitcoin.assets.default,
                from: ethereum.Account({ amount: outAmount }),
                to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
            });

            await completeGateway(burn);
        }

        // const migratedMintGateway = await create2<MigratedMintGateway__factory>(
        //     "MigratedMintGateway",
        //     [],
        //     undefined,
        //     "migratedMintGateway"
        // );
        // await renProxyAdmin.upgrade(gateway_1.address, migratedMintGateway.address);
        // const gateway_1_migrated = await ethers.getContractAt<MigratedMintGateway>(
        //     "MigratedMintGateway",
        //     gateway_1.address
        // );

        // Test minting and burning using new gateway.
        await ethGatewayRegistry.addMintGateway("BTC", renBTC.address, gateway_2.address);
        let mint3;
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

            mint3 = await completeGateway(mint, inAmount);

            expect(await getTxError(userSigner, mint3)).to.equal("Transaction may fail", "Resubmitting mint #3");

            await utils.sleep(0.1 * utils.sleep.SECONDS);

            const burn = await renJS.gateway({
                asset: bitcoin.assets.default,
                from: ethereum.Account({ amount: outAmount }),
                to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
            });

            await completeGateway(burn);
        }

        expect(await getTxError(userSigner, mint1)).to.equal(
            "MintGateway: signature already spent",
            "Resubmitting mint #1"
        );
        expect(await getTxError(userSigner, mint2)).to.equal(
            "MintGateway: signature already spent",
            "Resubmitting mint #2"
        );
        expect(await getTxError(userSigner, mint3)).to.equal("Transaction may fail", "Resubmitting mint #3");
    });
});
