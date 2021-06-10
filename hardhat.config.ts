import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
// TODO: reenable solidity-coverage when it works
// import "solidity-coverage";

const INFURA_KEY = process.env.INFURA_KEY || "";
const MNEMONIC_TESTNET = process.env.MNEMONIC_TESTNET;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const MNEMONIC_MAINNET = process.env.MNEMONIC_MAINNET;

if (!MNEMONIC_TESTNET && !MNEMONIC_MAINNET) {
    throw new Error(`Must set mnemonic.`);
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        compilers: [
            {
                version: "0.5.17",
                settings: {
                    // optimizer: {
                    //   enabled: true,
                    //   runs: 200
                    // }
                },
            },
        ],
    },
    networks: {
        hardhat: {},
        ethereum: {
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
            accounts: {
                mnemonic: MNEMONIC_MAINNET,
            },
        },
        ethereumMainnetVDot3: {
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
        },
        ethereumDevnet: {
            url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
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
        },
        polygonTestnet: {
            url: `https://rpc-mumbai.matic.today`,
            accounts: {
                mnemonic: MNEMONIC_TESTNET,
            },
        },
        polygonMainnet: {
            url: `https://rpc-mainnet.maticvigil.com`,
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
            url: `https://rpcapi.fantom.network`,
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
        coverage: {
            url: "http://127.0.0.1:8555", // Coverage launches its own ganache-cli client
        },
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: ETHERSCAN_KEY,
    },
};

export default config;
