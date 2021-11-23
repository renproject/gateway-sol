import chai, { expect } from "chai";
import ChaiAsPromised from "chai-as-promised";
import hre from "hardhat";
import log from "loglevel";

import {
    Ox0,
    randomAddress,
    setupCreate2,
    setupDeployProxy,
} from "../deploy/deploymentUtils";
import {
    GatewayRegistryV2,
    GatewayRegistryV2__factory,
    LockGatewayV3,
    LockGatewayV3__factory,
    MintGatewayV3,
    MintGatewayV3__factory,
    RenAssetV2,
    RenAssetV2__factory,
    RenProxyAdmin,
    TestToken,
} from "../typechain";
import { deployToken, getFixture } from "./utils";

chai.use(ChaiAsPromised);

const setup = hre.deployments.createFixture(async () => {
    const { deployments, ethers, getNamedAccounts, getUnnamedAccounts } = hre;

    log.setLevel("ERROR");
    const create2 = setupCreate2(hre, undefined, log);

    const [_, gatewayAdder, gatewayUpdater] = await getUnnamedAccounts();

    await deployments.fixture("GatewayRegistryV2");
    const gatewayRegistryV2 = await ethers.getContractAt<GatewayRegistryV2>(
        "GatewayRegistryV2",
        (
            await ethers.getContract("GatewayRegistryProxy")
        ).address
    );

    await gatewayRegistryV2.grantRole(await gatewayRegistryV2.CAN_ADD_GATEWAYS(), gatewayAdder);
    await gatewayRegistryV2.grantRole(await gatewayRegistryV2.CAN_ADD_GATEWAYS(), gatewayUpdater);
    await gatewayRegistryV2.grantRole(await gatewayRegistryV2.CAN_UPDATE_GATEWAYS(), gatewayUpdater);

    return {
        create2,
        gatewayRegistryV2,
        gatewayAdder,
        gatewayUpdater,
    };
});

describe("GatewayRegistry", function () {
    this.timeout(1000 * 1000);

    it("address getters", async () => {
        const { ethers } = hre;

        const { gatewayRegistryV2 } = await setup();

        // Mint

        // Check that the returned ERC20 address for renBTC is correct.
        const renBTCAddress_1 = await gatewayRegistryV2.getTokenBySymbol("BTC");
        const renBTCAddress_2 = await gatewayRegistryV2.getRenAssetBySymbol("BTC");
        expect(renBTCAddress_1).to.not.equal(Ox0);
        expect(renBTCAddress_1).to.equal(renBTCAddress_2);
        const renBTC = await ethers.getContractAt<RenAssetV2>("RenAssetV2", renBTCAddress_1);
        expect(await renBTC.symbol()).to.equal("devBTC");

        // Check that the returned Gateway address for renBTC is correct.
        const renBTCGateway_1 = await gatewayRegistryV2.getMintGatewayByToken(renBTCAddress_1);
        const renBTCGateway_2 = await gatewayRegistryV2.getGatewayByToken(renBTCAddress_1);
        const renBTCGateway_3 = await gatewayRegistryV2.getMintGatewayBySymbol("BTC");
        expect(renBTCGateway_1).to.not.equal(Ox0);
        expect(renBTCGateway_1).to.equal(renBTCGateway_2);
        expect(renBTCGateway_1).to.equal(renBTCGateway_3);
        const renBTCGateway = await ethers.getContractAt<MintGatewayV3>("MintGatewayV3", renBTCGateway_1);
        expect(await renBTCGateway.asset()).to.equal("BTC");

        // Lock

        // Check that the returned ERC20 address for renBTC is correct.
        const renDAIAddress_1 = await gatewayRegistryV2.getLockAssetBySymbol("DAI");
        expect(renDAIAddress_1).to.not.equal(Ox0);
        const renDAI = await ethers.getContractAt<TestToken>("TestToken", renDAIAddress_1);
        expect(await renDAI.symbol()).to.equal("DAI");

        // Check that the returned Gateway address for renBTC is correct.
        const renDAIGateway_1 = await gatewayRegistryV2.getLockGatewayByToken(renDAIAddress_1);
        const renDAIGateway_2 = await gatewayRegistryV2.getLockGatewayBySymbol("DAI");
        expect(renDAIGateway_1).to.not.equal(Ox0);
        expect(renDAIGateway_1).to.equal(renDAIGateway_2);
        const renDAIGateway = await ethers.getContractAt<LockGatewayV3>("LockGatewayV3", renDAIGateway_1);
        expect(await renDAIGateway.asset()).to.equal("DAI");
    });

    describe("gateway adder and updater", () => {
        it("gateway adder", async () => {
            const { ethers, getNamedAccounts } = hre;
            const { deployer } = await getNamedAccounts();

            let { create2, gatewayRegistryV2, gatewayAdder } = await setup();
            gatewayRegistryV2 = gatewayRegistryV2.connect(await ethers.getSigner(gatewayAdder));

            expect(await gatewayRegistryV2.hasRole(await gatewayRegistryV2.CAN_ADD_GATEWAYS(), gatewayAdder)).to.be
                .true;

            // deployMintGatewayAndRenAsset

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST0")).to.be.false;
            await gatewayRegistryV2.deployMintGatewayAndRenAsset("TEST0", "TEST0", "TEST0", 18, "3");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST0")).to.be.true;

            // deployLockGateway and deployMintGateway

            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.false;
            const test1 = await deployToken(hre, "TEST1");
            await gatewayRegistryV2.deployLockGateway("TEST1", test1.address, "1");
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.false;
            const renTEST1 = await create2<RenAssetV2__factory>("RenAssetV2", [], undefined, "TEST1");
            await gatewayRegistryV2.deployMintGateway("TEST1", renTEST1.address, "1");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;

            // addLockGateway and addMintGateway

            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.false;
            const test2 = await deployToken(hre, "TEST2");
            const test2LockGateway = await create2<LockGatewayV3__factory>("LockGatewayV3", [], undefined, "TEST2");
            await test2LockGateway.__LockGateway_init(
                "Hardhat",
                "TEST2",
                await gatewayRegistryV2.getSignatureVerifier(),
                test2.address,
                deployer
            );
            await gatewayRegistryV2.addLockGateway("TEST2", test2.address, test2LockGateway.address);
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.false;
            const renTEST2 = await create2<RenAssetV2__factory>("RenAssetV2", [], undefined, "TEST2");
            const test2MintGateway = await create2<MintGatewayV3__factory>("MintGatewayV3", [], undefined, "TEST2");
            await test2MintGateway.__MintGateway_init(
                "Hardhat",
                "TEST2",
                await gatewayRegistryV2.getSignatureVerifier(),
                renTEST2.address,
                deployer
            );
            await gatewayRegistryV2.addMintGateway("TEST2", renTEST2.address, test2MintGateway.address);
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;

            // Not updater

            await expect(gatewayRegistryV2.deployLockGateway("TEST1", Ox0, "1")).to.be.rejectedWith(
                /GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/
            );
            await expect(gatewayRegistryV2.deployMintGateway("TEST1", Ox0, "1")).to.be.rejectedWith(
                /GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/
            );

            await expect(gatewayRegistryV2.deployLockGateway("TEST3", test1.address, "1")).to.be.rejectedWith(
                /GatewayRegistry: TEST3 token already registered as TEST1/
            );
            await expect(gatewayRegistryV2.deployMintGateway("TEST3", renTEST1.address, "1")).to.be.rejectedWith(
                /GatewayRegistry: TEST3 token already registered as TEST1/
            );

            await expect(
                gatewayRegistryV2.addLockGateway("TEST2", test2.address, test2LockGateway.address)
            ).to.be.rejectedWith(/GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/);

            await expect(
                gatewayRegistryV2.addMintGateway("TEST2", renTEST2.address, test2MintGateway.address)
            ).to.be.rejectedWith(/GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/);

            await expect(gatewayRegistryV2.removeLockGateway("TEST1")).to.be.rejectedWith(
                /GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/
            );
            await expect(gatewayRegistryV2.removeMintGateway("TEST1")).to.be.rejectedWith(
                /GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/
            );

            await expect(gatewayRegistryV2.updateSignatureVerifier(Ox0)).to.be.rejectedWith(
                /GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/
            );

            await expect(gatewayRegistryV2.updateTransferWithLog(Ox0)).to.be.rejectedWith(
                /GatewayRegistry: account 0x[a-fA-F0-9]{40} is missing role CAN_UPDATE_GATEWAYS/
            );

            // Invalid string

            // Look-alike characters.
            await expect(gatewayRegistryV2.addMintGateway("еνіӏ", Ox0, Ox0)).to.be.rejectedWith(
                /GatewayRegistry: empty or invalid string input/
            );

            // Empty
            await expect(gatewayRegistryV2.addMintGateway("", Ox0, Ox0)).to.be.rejectedWith(
                /GatewayRegistry: empty or invalid string input/
            );

            // Getting symbols
            expect(await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).to.deep.equal([
                "BTC",
                "ZEC",
                "BCH",
                "TEST0",
                "TEST1",
                "TEST2",
            ]);
            expect(await gatewayRegistryV2.getMintGatewaySymbols(3, 1)).to.deep.equal(["TEST0"]);
            expect(await gatewayRegistryV2.getMintGatewaySymbols(4, 2)).to.deep.equal(["TEST1", "TEST2"]);

            const uninitializedGateway = await create2<GatewayRegistryV2__factory>(
                "GatewayRegistryV2",
                [],
                undefined,
                "uninitializedGateway"
            );
            await expect(uninitializedGateway.getSignatureVerifier()).to.be.rejectedWith(
                /GatewayRegistry: not initialized/
            );
            await expect(uninitializedGateway.getTransferWithLog()).to.be.rejectedWith(
                /GatewayRegistry: not initialized/
            );
        });

        it("gateway adder and updater", async () => {
            const { ethers, getNamedAccounts } = hre;
            const { deployer } = await getNamedAccounts();

            let { create2, gatewayRegistryV2, gatewayUpdater } = await setup();
            gatewayRegistryV2 = gatewayRegistryV2.connect(await ethers.getSigner(gatewayUpdater));

            expect(await gatewayRegistryV2.hasRole(await gatewayRegistryV2.CAN_UPDATE_GATEWAYS(), gatewayUpdater)).to.be
                .true;
            expect(await gatewayRegistryV2.hasRole(await gatewayRegistryV2.CAN_ADD_GATEWAYS(), gatewayUpdater)).to.be
                .true;

            // deployMintGatewayAndRenAsset

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST0")).to.be.false;
            await gatewayRegistryV2.deployMintGatewayAndRenAsset("TEST0", "TEST0", "TEST0", 18, "1");
            await gatewayRegistryV2.deployMintGatewayAndRenAsset("TEST0", "TEST0", "TEST0", 18, "2");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST0")).to.be.true;

            // deployLockGateway and deployMintGateway

            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.false;
            const test1_1 = await deployToken(hre, "TEST1");
            await gatewayRegistryV2.deployLockGateway("TEST1", test1_1.address, "1");
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;
            const test1_2 = await deployToken(hre, "TEST1");
            await gatewayRegistryV2.deployLockGateway("TEST1", test1_2.address, "2");
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.false;
            const renTEST1_1 = await create2<RenAssetV2__factory>("RenAssetV2", [], undefined, "TEST1_1");
            await gatewayRegistryV2.deployMintGateway("TEST1", renTEST1_1.address, "1");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;
            const renTEST1_2 = await create2<RenAssetV2__factory>("RenAssetV2", [], undefined, "TEST1_1");
            await gatewayRegistryV2.deployMintGateway("TEST1", renTEST1_2.address, "2");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;

            // // addLockGateway and addMintGateway

            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.false;
            const test2 = await deployToken(hre, "TEST2");
            const test2LockGateway_1 = await create2<LockGatewayV3__factory>("LockGatewayV3", [], undefined, "TEST2_1");
            await test2LockGateway_1.__LockGateway_init(
                "Hardhat",
                "TEST2",
                await gatewayRegistryV2.getSignatureVerifier(),
                test2.address,
                deployer
            );
            await gatewayRegistryV2.addLockGateway("TEST2", test2.address, test2LockGateway_1.address);
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;
            const test2LockGateway_2 = await create2<LockGatewayV3__factory>("LockGatewayV3", [], undefined, "TEST2_2");
            await test2LockGateway_2.__LockGateway_init(
                "Hardhat",
                "TEST2",
                await gatewayRegistryV2.getSignatureVerifier(),
                test2.address,
                deployer
            );
            await gatewayRegistryV2.addLockGateway("TEST2", test2.address, test2LockGateway_2.address);
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.false;
            const renTEST2 = await create2<RenAssetV2__factory>("RenAssetV2", [], undefined, "TEST2");
            const test2MintGateway_1 = await create2<MintGatewayV3__factory>("MintGatewayV3", [], undefined, "TEST2_1");
            await test2MintGateway_1.__MintGateway_init(
                "Hardhat",
                "TEST2",
                await gatewayRegistryV2.getSignatureVerifier(),
                renTEST2.address,
                deployer
            );
            await gatewayRegistryV2.addMintGateway("TEST2", renTEST2.address, test2MintGateway_1.address);
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;
            const test2MintGateway_2 = await create2<MintGatewayV3__factory>("MintGatewayV3", [], undefined, "TEST2_2");
            await test2MintGateway_2.__MintGateway_init(
                "Hardhat",
                "TEST2",
                await gatewayRegistryV2.getSignatureVerifier(),
                renTEST2.address,
                deployer
            );
            await gatewayRegistryV2.addMintGateway("TEST2", renTEST2.address, test2MintGateway_2.address);
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;

            await expect(gatewayRegistryV2.removeLockGateway("BAD_SYMBOL")).to.be.rejectedWith(
                /GatewayRegistry: gateway not registered/
            );

            await expect(gatewayRegistryV2.removeMintGateway("BAD_SYMBOL")).to.be.rejectedWith(
                /GatewayRegistry: gateway not registered/
            );

            // Remove first asset
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("BTC")).to.be.true;
            await gatewayRegistryV2.removeMintGateway("BTC");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("BTC")).to.be.false;

            // Remove middle asset
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;
            await gatewayRegistryV2.removeLockGateway("TEST1");
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST1")).to.be.false;

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.true;
            await gatewayRegistryV2.removeMintGateway("TEST1");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST1")).to.be.false;

            // Remove last asset
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;
            await gatewayRegistryV2.removeLockGateway("TEST2");
            expect((await gatewayRegistryV2.getLockGatewaySymbols(0, 0)).includes("TEST2")).to.be.false;

            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.true;
            await gatewayRegistryV2.removeMintGateway("TEST2");
            expect((await gatewayRegistryV2.getMintGatewaySymbols(0, 0)).includes("TEST2")).to.be.false;
        });

        it("updater can update signature verifier", async () => {
            let { gatewayRegistryV2 } = await setup();
            // Updating signature verifier

            await expect(gatewayRegistryV2.updateSignatureVerifier(Ox0)).to.be.rejectedWith(
                /GatewayRegistry: invalid signature verifier/
            );

            const signatureVerifier = await gatewayRegistryV2.getSignatureVerifier();
            const newSignatureVerifier = randomAddress();
            await gatewayRegistryV2.updateSignatureVerifier(newSignatureVerifier);
            expect(await gatewayRegistryV2.getSignatureVerifier()).to.equal(newSignatureVerifier);
            await gatewayRegistryV2.updateSignatureVerifier(signatureVerifier);
            expect(await gatewayRegistryV2.getSignatureVerifier()).to.equal(signatureVerifier);
        });

        it("updater can update TransferWithLog", async () => {
            let { gatewayRegistryV2 } = await setup();
            // Updating signature verifier

            await expect(gatewayRegistryV2.updateTransferWithLog(Ox0)).to.be.rejectedWith(
                /GatewayRegistry: invalid transfer with log/
            );

            const transferWithLog = await gatewayRegistryV2.getTransferWithLog();
            const newTransferWithLog = randomAddress();
            await gatewayRegistryV2.updateTransferWithLog(newTransferWithLog);
            expect(await gatewayRegistryV2.getTransferWithLog()).to.equal(newTransferWithLog);
            await gatewayRegistryV2.updateTransferWithLog(transferWithLog);
            expect(await gatewayRegistryV2.getTransferWithLog()).to.equal(transferWithLog);
        });
    });
});
