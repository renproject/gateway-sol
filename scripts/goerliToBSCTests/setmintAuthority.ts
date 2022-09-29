import BigNumber from "bignumber.js";
import chalk from "chalk";
import { keccak256 } from "ethers/lib/utils";
import { deployments, getNamedAccounts } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat";
import {ConsoleInterface, getContractAt, setupGetExistingDeployment, setupWaitForTx} from "../../deploy/deploymentUtils";
import { RenVMSignatureVerifierProxy, RenVMSignatureVerifierV2 } from "../../typechain";
async function setMintAuthority(logger: ConsoleInterface = console){
    const RenVMSignatureVerifier = await getContractAt(hre)<RenVMSignatureVerifierV2>("RenVMSignatureVerifierV2", "0xbd3B66fe20633a089438fBb16dbDc346975503d9");
    const {deployer} = await getNamedAccounts();
    const mintAuthority = "0x8e9b7b1f3f1f5b2b5b1f3f1f5b2b5b1f3f1f5b2b";
    const waitForTx = setupWaitForTx(logger);
    console.log(
        chalk.yellow(deployer),
        await RenVMSignatureVerifier.getMintAuthority(),
        await RenVMSignatureVerifier.owner()
    )
    const tx = await waitForTx(RenVMSignatureVerifier.updateMintAuthority(mintAuthority));
    console.log(tx);

}
setMintAuthority();
