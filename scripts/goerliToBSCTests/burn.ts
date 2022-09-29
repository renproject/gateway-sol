import hre from "hardhat";
import {
  MintGatewayV4,
  GatewayRegistryV3,
  TestToken
} from "../../typechain"
async function burn(){
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
  daiMintGateway.on(
    "LogBurn",(
    to,
    amount,
    _n,
    _indexedTo,)=>{
      console.log("LogBurn",to,amount,_n,_indexedTo);
    }
  )
  const burn = await daiMintGateway["burn(string,uint256)"]("0x8164f300DA804954E799F1C76367A33e3B7f2d78","5000000000000000000");
  console.log(burn);


}
burn()
