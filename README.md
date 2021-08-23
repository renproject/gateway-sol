# `⛩️ gateway-sol`

## EVM contracts for minting and burning ren-assets

Ren has two repositories for its Solidity contract:

-   [`darknode-sol`](https://github.com/renproject/darknode-sol) - contracts on Ethereum for managing darknode registrations.
-   `gateway-sol` (this repository) - contracts on multiple EVM chains for minting and burning of ren-assets.

## ~ [Documentation](https://renproject.github.io/ren-client-docs/contracts/) ~

-   For the latest contract addresses, see the [contract addresses](https://renproject.github.io/ren-client-docs/contracts/deployments) page.
-   For a summary of each contract, see the [summary of contracts](https://renproject.github.io/ren-client-docs/contracts/summary) page.

<details>

<summary>Development notes</summary>

## Setup

If you are using VSCode, put this into `.vscode/settings.json`:

```json
{
    "solidity.packageDefaultDependenciesContractsDirectory": "",
    "solidity.compileUsingRemoteVersion": "v0.5.17+commit.d19bba13"
}
```

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

For now, follow the same steps as in [./VERIFY.md](./VERIFY.md) until a script is written.

For contracts that use a Proxy, you then need to go to the Etherscan page, select "More Options" and then "Is this a proxy?":

![image](https://user-images.githubusercontent.com/2221955/110889473-4c881900-8342-11eb-8c50-0fd09c4e239a.png)

</details>
