# `⛩️ gateway-sol`

Ren gateway contracts written in Solidity

<!-- [![CircleCI](https://circleci.com/gh/renproject/gateway-sol.svg?style=shield)](https://circleci.com/gh/renproject/gateway-sol) -->
<!-- [![Coverage Status](https://coveralls.io/repos/github/renproject/gateway-sol/badge.svg?branch=master)](https://coveralls.io/github/renproject/gateway-sol?branch=master) -->

## Tests

Install the dependencies.

```
yarn install
```

Run the `ganache-cli` or an alternate Ethereum test RPC server on port 8545. The `-d` flag will use a deterministic mnemonic for reproducibility.

```sh
yarn ganache-cli -d
```

Run the Truffle test suite.

```sh
yarn run test
```

## Coverage

Run the Truffle test suite with coverage.

```sh
yarn run coverage
```

Open the coverage file.

```sh
open ./coverage/index.html
```

## Deploying

Add a `.env`, filling in the mnemonic and Infura key:

```sh
MNEMONIC_TESTNET="..."
MNEMONIC_MAINNET="..."
INFURA_KEY="..."
```

Deploy to Kovan:

```sh
NETWORK=kovan yarn run deploy
```

## Verifying Contract Code

Add an Etherscan API key to your `.env`:

```
ETHERSCAN_KEY="..."
```

Run the following (replacing the network and contract name):

```sh
NETWORK=mainnet yarn run verify Contract1 Contract2
```
