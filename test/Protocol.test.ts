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

// const NULL = "0x" + "00".repeat(20);

describe("Protocol", () => {
    it("getContract", async function () {
        this.timeout(1000 * 1000);

        const { protocol } = await setup();

        expect(new BigNumber(await protocol.getContract("DarknodeRegistry")).isZero()).to.be.false;
        expect(new BigNumber(await protocol.getContract("GetOperatorDarknodes")).isZero()).to.be.false;
        expect(new BigNumber(await protocol.getContract("ClaimRewards")).isZero()).to.be.false;
    });

    // it("Address getters", async () => {
    //     const { protocol } = await setup();

    //     (await protocol.getContract("DarknodeRegistry")).should.equal(dnr.address);
    // });

    // it("Protocol owner", async () => {
    //     const { protocol } = await setup();

    //     (await protocol.owner()).should.equal(owner);

    //     await protocol
    //         .transferOwnership(otherAccount, { from: otherAccount })
    //         .should.be.rejectedWith(/Ownable: caller is not the owner/);

    //     await protocol.transferOwnership(otherAccount);

    //     (await protocol.owner()).should.equal(owner);

    //     await protocol.claimOwnership({ from: otherAccount });

    //     (await protocol.owner()).should.equal(otherAccount);

    //     await protocol.transferOwnership(owner, { from: otherAccount });
    //     await protocol.claimOwnership({ from: owner });

    //     (await protocol.owner()).should.equal(owner);
    // });

    // it("Update DarknodeRegistry address", async () => {
    //     const { protocol } = await setup();

    //     await protocol
    //         .updateContract("DarknodeRegistry", NULL, { from: otherAccount })
    //         .should.be.rejectedWith(/Ownable: caller is not the owner/);

    //     await protocol.updateContract("DarknodeRegistry", NULL);

    //     (await protocol.getContract("DarknodeRegistry")).should.equal(NULL);

    //     await protocol.updateContract("DarknodeRegistry", dnr.address);

    //     (await protocol.getContract("DarknodeRegistry")).should.equal(dnr.address);
    // });

    // it("Proxy functions", async () => {
    //     const { protocol } = await setup();

    //     // Try to initialize again
    //     await protocol
    //         .__Protocol_init(owner, { from: owner })
    //         .should.be.rejectedWith(/Contract instance has already been initialized/);
    // });
});
