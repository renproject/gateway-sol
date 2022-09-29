import hre from "hardhat";
import {
  MintGatewayV4,
  GatewayRegistryV3,
} from "../../typechain"

async function Mint(amount: number) {
  let gatewayRegistry: GatewayRegistryV3;
  let daiMintGateway: MintGatewayV4;
  const { ethers, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);
  gatewayRegistry = await ethers.getContractAt("GatewayRegistryV3", "0x21B7E112337287043a77CE072f9508EdADaB9E6b");
  console.log(gatewayRegistry.address);
  const mintSymbols = await gatewayRegistry.getMintGatewaySymbols(0, 0);
  console.log(mintSymbols);
  const DaiMintGatewayAddr = await gatewayRegistry.getMintGatewayBySymbol("DAI");
  console.log(DaiMintGatewayAddr);
  daiMintGateway = await ethers.getContractAt("MintGatewayV4", DaiMintGatewayAddr);
  console.log(daiMintGateway.address);
  // DAIToken = await ethers.getContractAt("TestToken", DaiMintGatewayAddr);
  // console.log(DAIToken.address);
  const mint = await daiMintGateway.mint("0xd6d53bfaa30090962e504bb0927dcc98a189c5c5d3dbe0706d44db8490f30731","100000000000000000000","0x38ff999c6921617754870f838031ea944512266727a207f9e8aa019a25cc48bc","0x96d20e9895374a95421056c941b23ecd798350fede5a9d558348916a4808cf30785f9704965ab30fd5f3b3153c55c7f6cf8caeaadae48b58b828e0de307cac9339853a47081b5e34a2b4a0644b091f844afce3e87247632cc7b685546ec2e85d");
  console.log(mint);
}

Mint(100)
