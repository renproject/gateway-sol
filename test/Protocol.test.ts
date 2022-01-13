import BigNumber from "bignumber.js";
import { expect } from "chai";
import hre from "hardhat";

import { Protocol } from "../typechain";

const setup = hre.deployments.createFixture(async () => {
    const { deployments, ethers } = hre;
    await deployments.fixture(["Protocol", "GetOperatorDarknodes"]);

    const protocol = await ethers.getContract<Protocol>("Protocol");

    return { protocol };
});

describe("Protocol", () => {
    it("getContract", async function () {
        this.timeout(1000 * 1000);

        const { protocol } = await setup();
        expect(new BigNumber(await protocol.getContract("DarknodeRegistry")).isZero()).to.be.false;
        expect(new BigNumber(await protocol.getContract("GetOperatorDarknodes")).isZero()).to.be.false;
        expect(new BigNumber(await protocol.getContract("ClaimRewards")).isZero()).to.be.false;
    });
});
