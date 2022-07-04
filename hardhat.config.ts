import "dotenv/config";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";

import { HardhatUserConfig } from "hardhat/types";

import { accounts, node_url } from "./utils/network";

// While waiting for hardhat PR: https://github.com/nomiclabs/hardhat/pull/1542
if (process.env.HARDHAT_FORK) {
    process.env["HARDHAT_DEPLOY_FORK"] = process.env.HARDHAT_FORK;
}

const MNEMONIC_DEVNET = process.env.MNEMONIC_DEVNET || process.env.MNEMONIC;
const MNEMONIC_TESTNET = process.env.MNEMONIC_TESTNET || process.env.MNEMONIC;
const MNEMONIC_MAINNET = process.env.MNEMONIC_MAINNET || process.env.MNEMONIC;
const INFURA_KEY = process.env.INFURA_KEY || "";

if (!MNEMONIC_DEVNET || !MNEMONIC_TESTNET || !MNEMONIC_MAINNET) {
    throw new Error(`Must set MNEMONIC environment variable.`);
}

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.7",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    namedAccounts: {
        deployer: 0,
    },
    networks: {
        hardhat: {
            initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
            // process.env.HARDHAT_FORK will specify the network that the fork is made from.
            // this line ensure the use of the corresponding accounts
            accounts: accounts(process.env.HARDHAT_FORK),
            forking: process.env.HARDHAT_FORK
                ? {
                      // TODO once PR merged : network: process.env.HARDHAT_FORK,
                      url: node_url(process.env.HARDHAT_FORK),
                      blockNumber: process.env.HARDHAT_FORK_NUMBER
                          ? parseInt(process.env.HARDHAT_FORK_NUMBER)
                          : undefined,
                  }
                : undefined,
            // allowUnlimitedContractSize: true,
        },

        ethereumMainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
        },
        ethereumTestnet: {
            url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
            gasPrice: 2.5 * 1e9,
        },
        ethereumDevnet: {
            url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
            accounts: {
                mnemonic: MNEMONIC_DEVNET,
            },
        },
        bscTestnet: {
            url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
        },
        bscMainnet: {
            url: `https://bsc-dataseed1.binance.org/`,
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
            // gasPrice: 10 * 1e9,
        },
        polygonTestnet: {
            url: `https://rpc-mumbai.maticvigil.com/`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
        },
        polygonMainnet: {
            url: `https://polygon-rpc.com/`,
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
        },
        fantomTestnet: {
            url: `https://rpc.testnet.fantom.network/`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
        },
        fantomMainnet: {
            url: "https://rpc.ftm.tools",
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
        },
        avalancheTestnet: {
            url: `https://api.avax-test.network/ext/bc/C/rpc`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
        },
        avalancheMainnet: {
            url: `https://api.avax.network/ext/bc/C/rpc`,
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
        },

        arbitrumTestnet: {
            url: `https://rinkeby.arbitrum.io/rpc`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
            // gasPrice: 0, // https://developer.offchainlabs.com/docs/contract_deployment
            // gas: 80000000,
        },
        arbitrumMainnet: {
            url: `https://arb1.arbitrum.io/rpc`,
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
            // gasPrice: 0,
            // gas: 80000000,
        },

        goerliTestnet: {
            url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
            gasPrice: 2000000000,
        },
    },
    deterministicDeployment: (network: string) => {
        // Skip on hardhat's local network.
        if (network === "31337") {
            return undefined;
        }
        return {
            factory: "0x2222229fb3318a6375fa78fd299a9a42ac6a8fbf",
            deployer: "0x90899d3cc800c0a9196aec83da43e46582cb7435",
            // Must be deployed manually. Required funding may be more on
            // certain chains (e.g. Ethereum mainnet).
            funding: "10000000000000000",
            signedTx: "0x00",
        };
    },
    paths: {
        sources: "src",
    },
    gasReporter: {
        currency: "USD",
        gasPrice: 100,
        enabled: process.env.REPORT_GAS ? true : false,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        maxMethodDiff: 10,
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5",
    },
    mocha: {
        timeout: 0,
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: process.env.BSCSCAN_KEY,
    },
};

export default config;
