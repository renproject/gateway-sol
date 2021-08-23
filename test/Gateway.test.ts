import {Ethereum, EthereumConfig} from '@renproject/chains-ethereum';
import {MockChain, MockProvider} from '@renproject/mock-provider';
import RenJS, {LockAndMintDeposit} from '@renproject/ren';
import {RenVMProvider} from '@renproject/rpc/build/main/v2';
import BigNumber from 'bignumber.js';
import {ethers, deployments, getUnnamedAccounts} from 'hardhat';
import {
  GatewayRegistryV2,
  BasicBridge,
  SignatureVerifier,
  ERC20PresetMinterPauserUpgradeable,
} from '../typechain';
import {setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('GatewayRegistryV2');
  await deployments.fixture('BasicBridge');
  await deployments.fixture('SignatureVerifier');
  await deployments.fixture('ERC20PresetMinterPauserUpgradeable');

  const contracts = {
    GatewayRegistryV2: <GatewayRegistryV2>(
      (<unknown>await ethers.getContract('GatewayRegistryV2'))
    ),
    BasicBridge: <BasicBridge>(
      (<unknown>await ethers.getContract('BasicBridge'))
    ),
    SignatureVerifier: <SignatureVerifier>(
      (<unknown>await ethers.getContract('SignatureVerifier'))
    ),
    USDC: <ERC20PresetMinterPauserUpgradeable>(
      (<unknown>await ethers.getContract('ERC20PresetMinterPauserUpgradeable'))
    ),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  const user = users[0];

  const mockRenVMProvider = new MockProvider();
  const renJS = new RenJS(new RenVMProvider('testnet', mockRenVMProvider));

  // Set up mock Bitcoin chain.
  const Bitcoin = new MockChain('BTC');
  mockRenVMProvider.registerChain(Bitcoin);

  // Get mint authority from mock provider.
  const mintAuthority = mockRenVMProvider.mintAuthority();

  await user.SignatureVerifier.updateMintAuthority(mintAuthority);

  // Set up Ethereum network config.
  const providerNetwork = await ethers.provider.getNetwork();
  const networkID = providerNetwork ? providerNetwork.chainId : 0;
  const network = LocalEthereumNetwork(
    networkID,
    contracts.GatewayRegistryV2.address,
    contracts.BasicBridge.address
  );

  const ethereum = Ethereum(ethers.provider, network);

  return {
    ...contracts,
    users,
    Bitcoin,
    ethereum,
    renJS,
  };
});

describe('Mint', () => {
  it('Should mint some tokens', async function () {
    this.timeout(1000 * 1000);

    const {users, Bitcoin, renJS, ethereum} = await setup();

    // const [_, user] = await ethers.getSigners();

    // Use random amount, multiplied by the asset's decimals.
    const amount = new BigNumber(Math.random())
      .times(
        new BigNumber(10).exponentiatedBy(Bitcoin.assetDecimals(Bitcoin.asset))
      )
      .integerValue(BigNumber.ROUND_DOWN);

    // Initialize RenJS lockAndMint.
    const mint = await renJS.lockAndMint({
      // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
      asset: 'BTC', // `bitcoin.asset`
      from: Bitcoin,
      // If you change this to another chain, you also have to change the
      // chain name passed to `gatewayFactory` above.
      to: ethereum.Contract({
        // The contract we want to interact with
        sendTo: users[0].BasicBridge.address,

        // The name of the function we want to call
        contractFn: 'mint',

        // Arguments expected for calling `deposit`
        contractParams: [
          {
            name: 'symbol',
            type: 'string',
            value: 'BTC',
          },
          {
            name: 'recipient',
            type: 'address',
            value: users[0].address,
          },
        ],
      }),
    });

    // Mock deposit.
    Bitcoin.addUTXO(mint.gatewayAddress!, amount.toNumber());

    // Process the deposit, including the mint step.
    await new Promise<void>((resolve, reject) => {
      const depositCallback = async (deposit: LockAndMintDeposit) => {
        try {
          await deposit.confirmed();
          await deposit.signed();
          await deposit.mint().on('transactionHash', console.log);
          resolve();
        } catch (error) {
          console.error(error);
          mint.removeAllListeners();
          reject(error);
        }
      };
      mint.on('deposit', depositCallback);
    });
  });
});

const LocalEthereumNetwork = (
  networkID: number,
  gatewayRegistry: string,
  basicAdapter: string
): EthereumConfig => ({
  name: 'hardhat',
  chain: 'hardhat',
  chainLabel: 'Hardhat',
  isTestnet: true,
  networkID,
  infura: '',
  publicProvider: () => '',
  explorer: {
    address: () => '',
    transaction: () => '',
  },
  etherscan: '',
  addresses: {
    GatewayRegistry: gatewayRegistry,
    BasicAdapter: basicAdapter,
  },
});
