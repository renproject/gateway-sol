import { expect } from "chai";
import hre from "hardhat";

import { GatewayRegistryV2 } from "../typechain";
import { Ox0 } from "./utils";

const setup = hre.deployments.createFixture(async () => {
    const { deployments, ethers } = hre;

    await deployments.fixture("GatewayRegistryV2");
    const gatewayRegistryV2 = await ethers.getContractAt<GatewayRegistryV2>(
        "GatewayRegistryV2",
        (
            await ethers.getContract("GatewayRegistryProxy")
        ).address
    );

    return {
        gatewayRegistryV2,
    };
});

describe.only("GatewayRegistry", () => {
    it("address getters", async function () {
        this.timeout(1000 * 1000);

        const { gatewayRegistryV2 } = await setup();

        const renBTCAddress_1 = await gatewayRegistryV2.getTokenBySymbol("BTC");
        const renBTCAddress_2 = await gatewayRegistryV2.getRenAssetBySymbol("BTC");
        const renBTCGateway_1 = await gatewayRegistryV2.getMintGatewayByToken(renBTCAddress_1);
        const renBTCGateway_2 = await gatewayRegistryV2.getMintGatewayBySymbol("BTC");

        expect(renBTCAddress_1).to.not.equal(Ox0);
        expect(renBTCGateway_1).to.not.equal(Ox0);
        expect(renBTCAddress_1).to.equal(renBTCAddress_2);
        expect(renBTCGateway_1).to.equal(renBTCGateway_2);
    });
});
