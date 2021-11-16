import BigNumber from "bignumber.js";
import hre from "hardhat";

import { RenAssetV2 } from "../typechain";
import { completeGateway, setupNetworks } from "./utils";

const setup = hre.deployments.createFixture(async () => {
    const { deployments } = hre;

    await deployments.fixture("GatewayRegistryV2");

    const { bitcoin, ethereum, bsc, renJS } = await setupNetworks(hre);

    return {
        bitcoin,
        ethereum,
        bsc,
        renJS,
    };
});

describe("RenJS", () => {
    it("mint and burn", async function () {
        this.timeout(1000 * 1000);

        const { getUnnamedAccounts, ethers } = hre;
        const [user] = await getUnnamedAccounts();

        const { bitcoin, renJS, ethereum, bsc } = await setup();

        const inAmount = new BigNumber(Math.random() + 1)
            .shiftedBy(bitcoin.assetDecimals(bitcoin.assets.default))
            .integerValue(BigNumber.ROUND_DOWN);

        const mint = await renJS.gateway({
            asset: bitcoin.assets.default,
            from: bitcoin.GatewayAddress(),
            to: ethereum.Account(),
        });
        const outAmount = await mint.fees.estimateOutput(inAmount);

        await completeGateway(mint, inAmount);

        const burn = await renJS.gateway({
            asset: bitcoin.assets.default,
            from: ethereum.Account({ amount: outAmount }),
            to: bitcoin.Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        });

        await completeGateway(burn);

        // const renUSDC = (await (
        //     await ethers.getContractAt("RenAssetV2", await bsc.getRenAsset(ethereum.assets.USDC))
        // ).connect(await ethers.getSigner(user))) as RenAssetV2;
        // console.log("USDC balance", new BigNumber((await renUSDC.balanceOf(user)).toString()).toFixed());

        const daiMint = await renJS.gateway({
            asset: ethereum.assets.USDC,
            from: ethereum.Account({ amount: inAmount }),
            to: bsc.Account(),
        });
        const daiMintOutput = daiMint.fees.estimateOutput(inAmount);
        await completeGateway(daiMint);

        // console.log("USDC balance", new BigNumber((await renUSDC.balanceOf(user)).toString()).toFixed());

        const daiBurn = await renJS.gateway({
            asset: ethereum.assets.USDC,
            from: bsc.Account({ amount: daiMintOutput }),
            to: ethereum.Account(),
        });
        await completeGateway(daiBurn);

        const ethMint = await renJS.gateway({
            asset: ethereum.assets.ETH,
            from: ethereum.Account({ amount: inAmount }),
            to: bsc.Account(),
        });
        await completeGateway(ethMint);
        const ethOutAmount = await ethMint.fees.estimateOutput(inAmount);

        const ethBurn = await renJS.gateway({
            asset: ethereum.assets.ETH,
            from: bsc.Account({ amount: ethOutAmount }),
            to: ethereum.Account(),
        });
        await completeGateway(ethBurn);
    });
});
