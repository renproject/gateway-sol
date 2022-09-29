import hre from "hardhat";
import {
  LockGatewayV4,
  GatewayRegistryV3,
  TestToken,
  RenTimelock
} from "../../typechain"
import{
  setupGetExistingDeployment
} from "../../deploy/deploymentUtils";
import { AbiCoder, keccak256 } from "ethers/lib/utils";

async function Lock(amount: number) {
  let gatewayRegistry: GatewayRegistryV3;
  let daiLockGateway: LockGatewayV4;
  let renlock: RenTimelock;
  let DAIToken: TestToken;
  const { ethers, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);
  // gatewayRegistry = await setupGetExistingDeployment(hre)("GatewayRegistryV3");
  gatewayRegistry = await ethers.getContractAt("GatewayRegistryV3", "0x21B7E112337287043a77CE072f9508EdADaB9E6b");
  console.log(gatewayRegistry.address);
  const lockSymbols = await gatewayRegistry.getLockGatewaySymbols(0, 0);
  console.log(lockSymbols);
  const DaiLockGateway = await gatewayRegistry.getLockGatewayBySymbol("DAI");
  console.log(DaiLockGateway);
  let abiCoder = new ethers.utils.AbiCoder();
  const mintAuthorityTest = abiCoder.encode(["uint256","uint8"],["59480503854050047915252877159507673647505112920444584507280176769275516298029","0"]);
  console.log(mintAuthorityTest);
  // const DAITokenAddr = await gatewayRegistry.getTokenBySymbol("DAI");
  // console.log(DAITokenAddr);
  DAIToken = await ethers.getContractAt("TestToken", "0x9e18271B22A2d3c6dC04D7AbF8fB69817900207b");
  console.log("DAITokenAddr", DAIToken.address);
  const approval = await DAIToken.approve(DaiLockGateway, (amount * 10 ** 18).toString());
  console.log(approval);
  daiLockGateway = await ethers.getContractAt("LockGatewayV4", DaiLockGateway);
  console.log(daiLockGateway.address);
  daiLockGateway.on("LogLockToChain", (
    recipientAddress,
    recipientChain,
    recipientPayload,
    transferredAmountOrTokenId,
    lockNonce,
    recipientAddressi,
    recipientChaini
  ) => {
    console.log("LogLockToChain",
      recipientAddress,
      recipientChain,
      recipientPayload,
      transferredAmountOrTokenId,
      lockNonce,
      recipientAddressi,
      recipientChaini
    );
  });
  const lock = await daiLockGateway.lock("0x8164f300DA804954E799F1C76367A33e3B7f2d78", "BinanceSmartChain", "0x8164f300DA804954E799F1C76367A33e3B7f2d78", (amount * 10 ** 18).toString());
  console.log(lock);

}
Lock(100);
