require("ts-node/register");
require("dotenv").config();

const bip39 = require("ethereum-cryptography/bip39");
const HDWalletProvider = require("truffle-hdwallet-provider");
const { execSync } = require("child_process")
const EthereumHDKey = require("ethereumjs-wallet/dist/hdkey.js").default;
const { wordlist } = require("ethereum-cryptography/bip39/wordlists/english");

const GWEI = 1000000000;
const commitHash = execSync("git describe --always --long").toString().trim();

if (/devnet|testnet|main/i.exec(process.env.NETWORK || "") && process.env.INFURA_KEY === undefined) {
  throw new Error("Must set INFURA_KEY");
}

const Kit = require('@celo/contractkit');
const kit = Kit.newKit('https://alfajores-forno.celo-testnet.org');

const Network = {
  EthMainnet: {
    // @ts-ignore
    provider: () => new HDWalletProvider(process.env.MNEMONIC_MAINNET, `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`),
    network_id: 1,
    // gas: 3000000,
    gas: 1229470,
    // gas: 300000,
    gasPrice: 54 * GWEI,
    networkCheckTimeout: 10000,
  },

  EthKovan: {
    // @ts-ignore
    provider: () => new HDWalletProvider(process.env.MNEMONIC_TESTNET, `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`),
    network_id: 42,
    // gas: 6721975,
    // gasPrice: 6.5 * GWEI,
    networkCheckTimeout: 10000,
  },

  EthRinkeby: {
    // @ts-ignore
    provider: () => new HDWalletProvider(process.env.MNEMONIC_TESTNET, `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`),
    network_id: 4,
    // gas: 6721975,
    // gasPrice: 6.5 * GWEI,
    networkCheckTimeout: 10000,
  },

  BscMainnet: {
    // @ts-ignore
    provider: () => new HDWalletProvider(process.env.MNEMONIC_MAINNET, `https://bsc-dataseed1.binance.org/`),
    network_id: 56,
    // gas: 30000000,
    networkCheckTimeout: 10000,
  },

  BscTestnet: {
    // @ts-ignore
    provider: () => new HDWalletProvider(process.env.MNEMONIC_TESTNET, `https://data-seed-prebsc-1-s1.binance.org:8545`),
    network_id: 97,
    // gas: 30000000,
    networkCheckTimeout: 10000,
  },

  CeloTestnet: {
    // @ts-ignore
    provider: () => {
      const mnemonic = process.env.MNEMONIC_TESTNET;

      const hdwallet = EthereumHDKey.fromMasterSeed(
        bip39.mnemonicToSeedSync(mnemonic)
      );

      if (!bip39.validateMnemonic(mnemonic, wordlist)) {
        throw new Error("Mnemonic invalid or undefined");
      }

      // crank the addresses out
      const wallet = hdwallet
        .derivePath("m/44'/60'/0'/0/0")
        .getWallet();
      kit.addAccount("0x" + wallet.getPrivateKey().toString("hex"))

      return kit.web3.currentProvider;
    },
    network_id: 44787,
    // gas: 30000000,
    networkCheckTimeout: 10000,
  },
}

module.exports = {
  networks: {
    // v0.2 //

    // Mainnet
    mainnet: Network.EthMainnet,
    // Kovan
    testnet: Network.EthKovan,

    // v0.3 //

    // Mainnet
    mainnetVDot3: Network.EthMainnet,
    // Rinkeby
    devnetVDot3: Network.EthRinkeby,
    testnetVDot3: Network.EthRinkeby,
    // BSC
    bscDevnetVDot3: Network.BscTestnet,
    bscTestnetVDot3: Network.BscTestnet,
    bscMainnetVDot3: Network.BscMainnet,
    // Celo
    celoTestnetVDot3: Network.CeloTestnet,

    // Dev //

    // Dev
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
    },
  },
  mocha: {
    // // Use with `npm run test`, not with `npm run coverage`
    // reporter: 'eth-gas-reporter',
    // reporterOptions: {
    //   currency: 'USD',
    //   gasPrice: 21
    // },
    enableTimeouts: false,
    useColors: true,
    bail: false,
  },
  compilers: {
    solc: {
      version: "0.5.16",
      settings: {
        // evmVersion: "petersburg", // "istanbul",
        optimizer: {
          enabled: true,
          runs: 200,
        }
      }
    }
  },
  plugins: [
    'truffle-plugin-verify',
    'solidity-coverage'
  ],
  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
  },
  verify: {
    preamble: `
Deployed by Ren Project, https://renproject.io

Commit hash: ${commitHash}
Repository: https://github.com/renproject/gateway-sol
Issues: https://github.com/renproject/gateway-sol/issues

Licenses
@openzeppelin/contracts: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE
gateway-sol: https://github.com/renproject/gateway-sol/blob/master/LICENSE
`
  },
  contracts_build_directory: `./build/${process.env.NETWORK || "development"}`,
  // This is required by truffle to find any ts test files
  test_file_extension_regexp: /.*\.ts$/,
};
