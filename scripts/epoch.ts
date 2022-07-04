import hre from "hardhat";
import { NetworkConfig, networks } from "../deploy/networks";
// example script

const ABI = [
    {
        constant: false,
        inputs: [],
        name: "epoch",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
    },
];

async function main() {
    const { getNamedAccounts, ethers, network } = hre;

    console.log(`Calling epoch on ${network.name}...`);

    const config: NetworkConfig = networks[network.name as "hardhat"];
    if (!config) {
        throw new Error(`No network configuration found for ${network.name}!`);
    }

    const { darknodeRegistry } = config;
    const { deployer } = await getNamedAccounts();

    const contract = new ethers.Contract(darknodeRegistry, ABI).connect(await ethers.getSigner(deployer));

    const tx = await contract.epoch();
    console.log(tx.hash);
    await tx.wait();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
