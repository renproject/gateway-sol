import "dotenv/config";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";

import { HardhatUserConfig } from "hardhat/types";

import { accounts, node_url } from "./utils/network";

// While waiting for hardhat PR: https://github.com/nomiclabs/hardhat/pull/1542
if (process.env.HARDHAT_FORK) {
    process.env["HARDHAT_DEPLOY_FORK"] = process.env.HARDHAT_FORK;
}

const MNEMONIC_TESTNET = process.env.MNEMONIC;
const MNEMONIC_MAINNET = process.env.MNEMONIC_MAINNET;
const MNEMONIC_DEVNET = process.env.MNEMONIC_DEVNET;
const INFURA_KEY = process.env.INFURA_KEY || "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.7",
    },
    namedAccounts: {
        deployer: 0,
        simpleERC20Beneficiary: 1,
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
        // localhost: {
        //   url: node_url('localhost'),
        //   accounts: accounts(),
        // },
        // staging: {
        //   url: node_url('rinkeby'),
        //   accounts: accounts('rinkeby'),
        // },
        // production: {
        //   url: node_url('mainnet'),
        //   accounts: accounts('mainnet'),
        // },
        // mainnet: {
        //   url: node_url('mainnet'),
        //   accounts: accounts('mainnet'),
        // },
        // rinkeby: {
        //   url: node_url('rinkeby'),
        //   accounts: accounts('rinkeby'),
        // },
        // kovan: {
        //   url: node_url('kovan'),
        //   accounts: accounts('kovan'),
        // },
        // goerli: {
        //   url: node_url('goerli'),
        //   accounts: accounts('goerli'),
        // },

        ethereumMainnet: {
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
        },
        polygonTestnet: {
            url: `https://rpc-mumbai.maticvigil.com/`,
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
        },
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
