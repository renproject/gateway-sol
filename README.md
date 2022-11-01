# `⛩️ gateway-sol`

## EVM contracts for minting and burning ren-assets

Ren has two repositories for its Solidity contract:

- [`darknode-sol`](https://github.com/renproject/darknode-sol) - contracts on Ethereum for managing darknode registrations.
- `gateway-sol` (this repository) - contracts on multiple EVM chains for minting and burning of ren-assets.

## ~ [Documentation](https://renproject.github.io/ren-client-docs/contracts/) ~

- For the latest contract addresses, see the [contract addresses](https://renproject.github.io/ren-client-docs/contracts/deployments) page.
- For a summary of each contract, see the [summary of contracts](https://renproject.github.io/ren-client-docs/contracts/summary) page.

## Contract summary

There are three core layers in the gateway-sol contracts:

- **GatewayRegistry** - responsible for deploying and tracking gateway and asset instances
- **RenAsset** - ERC20s backed 1:1 by a corresponding asset on another chain. e.g. renDAI on Fantom is backed by DAI on Ethereum
- **Gateways** - responsible for minting and burning (_MintGateway_) and locking and releasing (_LockGateway_) Ren assets.

![gateway-sol diagram](https://user-images.githubusercontent.com/2221955/137038758-bbdba875-d73d-445b-8c81-76eec038a02d.png)

For example, minting renDAI on Fantom backed by DAI on Ethereum involves the following contracts:

- On Ethereum:
  - The Ethereum GatewayRegistry
  - A DAI LockGateway
- On Fantom:
  - The Fantom GatewayRegistry
  - A DAI MintGateway
  - A renDAI RenAsset

<details>

<summary>Development notes</summary>

## INSTALL

```bash
yarn
```

## TEST

```bash
yarn test
```

## SCRIPTS

Here is the list of npm scripts you can execute:

Some of them relies on [./config/\_scripts.js](./config/_scripts.js) to allow parameterizing it via command line argument (have a look inside if you need modifications)
<br/><br/>

`yarn prepare`

As a standard lifecycle npm script, it is executed automatically upon install. It generate config file and typechain to get you started with type safe contract interactions
<br/><br/>

`yarn lint`, `yarn lint:fix`, `yarn format` and `yarn format:fix`

These will lint and format check your code. the `:fix` version will modifiy the files to match the requirement specified in `.eslintrc` and and the prettier config in `package.json`
<br/><br/>

`yarn compile`

These will compile your contracts
<br/><br/>

`yarn void:deploy`

This will deploy your contracts on the in-memory hardhat network and exit, leaving no trace. quick way to ensure deployments work as intended without consequences
<br/><br/>

`yarn test [mocha args...]`

These will execute your tests using mocha. you can pass extra arguments to mocha
<br/><br/>

`yarn coverage`

These will produce a coverage report in the `coverage/` folder
<br/><br/>

`yarn gas`

These will produce a gas report for function used in the tests
<br/><br/>

`yarn dev`

These will run a local hardhat network on `localhost:8545` and deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

`yarn local:dev`

This assumes a local node it running on `localhost:8545`. It will deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

`yarn execute <network> <file.ts> [args...]`

This will execute the script `<file.ts>` against the specified network
<br/><br/>

`yarn deploy <network> [args...]`

This will deploy the contract on the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it
<br/><br/>

`yarn export <network> <file.json>`

This will export the abi+address of deployed contract to `<file.json>`
<br/><br/>

`yarn fork:execute <network> [--blockNumber <blockNumber>] [--deploy] <file.ts> [args...]`

This will execute the script `<file.ts>` against a temporary fork of the specified network

if `--deploy` is used, deploy scripts will be executed
<br/><br/>

`yarn fork:deploy <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a temporary fork of the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it
<br/><br/>

`yarn fork:test <network> [--blockNumber <blockNumber>] [mocha args...]`

This will test the contract against a temporary fork of the specified network.
<br/><br/>

`yarn fork:dev <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a fork of the specified network and it will keep running as a node.

Behind the scene it uses `hardhat node` command so you can append any argument for it

## Verifying

`yarn hardhat --network kovan etherscan-verify --api-key ETHERSCAN_KEY --license GPL-3.0`

For contracts that use a Proxy, you then need to go to the Etherscan page, select "More Options" and then "Is this a proxy?":

![image](https://user-images.githubusercontent.com/2221955/110889473-4c881900-8342-11eb-8c50-0fd09c4e239a.png)

</details>
