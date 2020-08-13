require("ts-node/register");
require("dotenv").config();

const bip39 = require("ethereum-cryptography/bip39");
const HDWalletProvider = require("truffle-hdwallet-provider");
const { execSync } = require("child_process")
const EthereumHDKey = require("ethereumjs-wallet/dist/hdkey.js").default;
const { wordlist } = require("ethereum-cryptography/bip39/wordlists/english");

const GWEI = 1000000000;
const commitHash = execSync("git describe --always --long").toString().trim();

if ((process.env.NETWORK || "").match(/localnet|devnet|testnet|main/) && process.env.INFURA_KEY === undefined) {
  throw new Error("Must set INFURA_KEY");
}

const Kit = require('@celo/contractkit')
const kit = Kit.newKit('https://alfajores-forno.celo-testnet.org')

const ethMainNetwork = {
  // @ts-ignore
  provider: () => new HDWalletProvider(process.env.MNEMONIC_MAINNET, `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`),
  network_id: 1,
  gas: 8721975,
  gasPrice: 18 * GWEI,
  networkCheckTimeout: 10000,
};

const ethKovanNetwork = {
  // @ts-ignore
  provider: () => new HDWalletProvider(process.env.MNEMONIC_KOVAN, `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`),
  network_id: 42,
  gas: 6721975,
  gasPrice: 6.5 * GWEI,
  networkCheckTimeout: 10000,
};

const bnbTestnetNetwork = {
  // @ts-ignore
  provider: () => new HDWalletProvider(process.env.MNEMONIC_KOVAN, `https://data-seed-prebsc-1-s1.binance.org:8545`),
  network_id: 97,
  // gas: 30000000,
  networkCheckTimeout: 10000,
};

const celoTestnetNetwork = {
  // @ts-ignore
  provider: () => {
    const mnemonic = process.env.MNEMONIC_KOVAN;

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
};

module.exports = {
  networks: {
    localnet: ethKovanNetwork,
    devnet: ethKovanNetwork,
    testnet: ethKovanNetwork,
    mainnet: ethMainNetwork,
    chaosnet: ethMainNetwork,
    bnbTestnet: bnbTestnetNetwork,
    celoTestnet: celoTestnetNetwork,
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
