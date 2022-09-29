import hre from "hardhat";
import {
  LockGatewayV4,
  GatewayRegistryV3,
} from "../../typechain"

async function release(amount: number) {
  let gatewayRegistry: GatewayRegistryV3;
  let daiLockGateway: LockGatewayV4;
  const { ethers, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);
  gatewayRegistry = await ethers.getContractAt("GatewayRegistryV3", "0x21B7E112337287043a77CE072f9508EdADaB9E6b");
  console.log(gatewayRegistry.address);
  const lockSymbols = await gatewayRegistry.getLockGatewaySymbols(0, 0);
  console.log(lockSymbols);
  const DaiLockGateway = await gatewayRegistry.getLockGatewayBySymbol("DAI");
  console.log(DaiLockGateway);
  daiLockGateway = await ethers.getContractAt("LockGatewayV4", DaiLockGateway);
  console.log(daiLockGateway.address);
  daiLockGateway.on("LogRelease", (
    recipient,
    amountOrTokenId,
    sigHash,
    nHash) => {
    console.log("LogLockToChain",
      recipient,
      amountOrTokenId,
      sigHash,
      nHash
    );
  });
  const release = await daiLockGateway.release("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", (amount * 10 ** 18).toString(), "0x0c8037bdc6c8e42c24583257eb93658edd980b474d26c1617b5d285bbe5aa9a8", "0xedadb0eff8fb4beff3289ae1c749c073d91dac79bbb509c418d18c40174fd6ba719332d695e609a674e332aaa7c01006e813d8c6b16ed814d8bee20e8d2f282c2b7571d40701a821e900f78deec802fbe29c368cc239ac403d96d404a0705256");
  console.log(release);

}
release(5);
