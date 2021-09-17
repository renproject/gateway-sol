import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {CallOptions, DeployFunction} from 'hardhat-deploy/types';
import {keccak256} from 'ethers/lib/utils';
import {
  GatewayRegistryV2,
  RenAssetProxyBeaconV1,
  MintGatewayProxyBeaconV1,
  LockGatewayProxyBeaconV1,
  SignatureVerifierV1,
} from '../typechain';
import {BaseContract, ContractTransaction} from 'ethers';
import {networks} from './networks';

const Ox0 = '0x0000000000000000000000000000000000000000';

const CREATE2_SALT = keccak256(Buffer.from('REN-0001'));

const setupCreate2 =
  (hre: HardhatRuntimeEnvironment, overrides?: CallOptions) =>
  async <T extends BaseContract>(name: string, args: any[]): Promise<T> => {
    const {deployments, getNamedAccounts, ethers} = hre;
    const {deploy} = deployments;

    const {deployer} = await getNamedAccounts();
    console.log(`Deploying ${name} from ${deployer}`);

    const result = await deploy(name, {
      from: deployer,
      args: args,
      log: true,
      deterministicDeployment: CREATE2_SALT,
      skipIfAlreadyDeployed: true,
      ...overrides,
    });
    console.log(`Deployed ${name} at ${result.address}.`);
    return await ethers.getContractAt<T>(name, result.address, deployer);
  };

const setupDeployProxy =
  (
    hre: HardhatRuntimeEnvironment,
    create2: <T extends BaseContract>(name: string, args: any[]) => Promise<T>,
    proxyAdmin: string
  ) =>
  async <T extends BaseContract>(
    contractName: string,
    proxyName: string,
    initialize: (t: T) => Promise<void>
  ): Promise<T> => {
    const {getNamedAccounts, ethers} = hre;

    const {deployer} = await getNamedAccounts();

    const implementation = await create2<T>(contractName, []);

    console.log(`Initializing ${contractName} instance (optional).`);
    await initialize(implementation);

    const proxy = await create2(proxyName, [
      implementation.address,
      proxyAdmin,
      [],
    ]);
    const final = await ethers.getContractAt<T>(
      contractName,
      proxy.address,
      deployer
    );

    console.log(`Initializing ${contractName} proxy.`);
    await initialize(final);

    return final;
  };

const waitForTx = async (
  callTx: () => Promise<ContractTransaction>,
  msg?: string
) => {
  if (msg) {
    console.log(msg);
  }
  const tx = await callTx();
  console.log(tx.hash);
  await tx.wait();
  console.log('Done.');
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts, ethers, network} = hre;
  const {deploy} = deployments;

  console.log(`Deploying to ${network.name}...`);

  const Ox = ethers.utils.getAddress;

  const config = networks[network.name as 'hardhat'];
  if (!config) {
    throw new Error(`No network configuration found for ${network.name}!`);
  }

  const create2 = setupCreate2(hre);

  const {deployer} = await getNamedAccounts();

  const chainName = config.chainName;
  const chainId: number = (await ethers.provider.getNetwork()).chainId;
  const mintAuthority = config.mintAuthority;

  console.log('chainName', chainName);
  console.log('chainId', chainId);
  console.log('mintAuthority', mintAuthority);

  // Deploy RenProxyAdmin ////////////////////////////////////////////////
  const renProxyAdmin = await create2('RenProxyAdmin', []);
  const deployProxy = setupDeployProxy(hre, create2, renProxyAdmin.address);

  // Deploy RenAssetProxyBeacon ////////////////////////////////////////////////
  const renAssetImplementation = await create2('RenAssetV2', []);
  const renAssetProxyBeacon = await create2<RenAssetProxyBeaconV1>(
    'RenAssetProxyBeaconV1',
    [renAssetImplementation.address, deployer]
  );

  // Deploy MintGatewayProxyBeacon /////////////////////////////////////////////
  const mintGatewayImplementation = await create2('MintGatewayV3', []);
  const mintGatewayProxyBeacon = await create2<MintGatewayProxyBeaconV1>(
    'MintGatewayProxyBeaconV1',
    [mintGatewayImplementation.address, deployer]
  );

  // Deploy LockGatewayProxyBeacon /////////////////////////////////////////////
  const lockGatewayImplementation = await create2('LockGatewayV3', []);
  const lockGatewayProxyBeacon = await create2<LockGatewayProxyBeaconV1>(
    'LockGatewayProxyBeaconV1',
    [lockGatewayImplementation.address, deployer]
  );

  const signatureVerifier = await deployProxy<SignatureVerifierV1>(
    'SignatureVerifierV1',
    'SignatureVerifierProxy',
    async (signatureVerifier) => {
      const currentMintAuthority = Ox(await signatureVerifier.mintAuthority());
      if (currentMintAuthority !== Ox(mintAuthority)) {
        await waitForTx(async () =>
          signatureVerifier.__SignatureVerifier_init(mintAuthority)
        );
      } else {
        console.log(`Already initialized.`);
      }
    }
  );

  // Deploy GatewayRegistry ////////////////////////////////////////////////////
  const gatewayRegistry = await deployProxy<GatewayRegistryV2>(
    'GatewayRegistryV2',
    'GatewayRegistryProxy',
    async (gatewayRegistry) => {
      const currentChainName = await gatewayRegistry.chainName();
      if (currentChainName !== chainName) {
        await waitForTx(async () =>
          gatewayRegistry.__GatewayRegistry_init(
            chainName,
            chainId,
            renAssetProxyBeacon.address,
            mintGatewayProxyBeacon.address,
            lockGatewayProxyBeacon.address,
            deployer
          )
        );
      } else {
        console.log(`Already initialized.`);
      }
    }
  );
  if (
    Ox(await gatewayRegistry.signatureVerifier()) !==
    Ox(signatureVerifier.address)
  ) {
    console.log(`Updating signature verifier in gateway registry`);
    await waitForTx(async () =>
      gatewayRegistry.updateSignatureVerifier(signatureVerifier.address, {
        ...config.overrides,
      })
    );
  }

  if (
    !(await renAssetProxyBeacon.hasRole(
      await renAssetProxyBeacon.PROXY_DEPLOYER(),
      gatewayRegistry.address
    ))
  ) {
    console.log(
      `Granting deployer role to gateway registry in renAssetProxyBeacon`
    );
    await waitForTx(async () =>
      renAssetProxyBeacon.grantRole(
        await renAssetProxyBeacon.PROXY_DEPLOYER(),
        gatewayRegistry.address,
        {
          ...config.overrides,
        }
      )
    );
  }

  if (
    !(await mintGatewayProxyBeacon.hasRole(
      await mintGatewayProxyBeacon.PROXY_DEPLOYER(),
      gatewayRegistry.address
    ))
  ) {
    console.log(
      `Granting deployer role to gateway registry in mintGatewayProxyBeacon`
    );
    await waitForTx(async () =>
      mintGatewayProxyBeacon.grantRole(
        await mintGatewayProxyBeacon.PROXY_DEPLOYER(),
        gatewayRegistry.address,
        {
          ...config.overrides,
        }
      )
    );
  }

  if (
    !(await lockGatewayProxyBeacon.hasRole(
      await lockGatewayProxyBeacon.PROXY_DEPLOYER(),
      gatewayRegistry.address
    ))
  ) {
    console.log(
      `Granting deployer role to gateway registry in lockGatewayProxyBeacon`
    );
    await waitForTx(async () =>
      lockGatewayProxyBeacon.grantRole(
        await lockGatewayProxyBeacon.PROXY_DEPLOYER(),
        gatewayRegistry.address,
        {
          ...config.overrides,
        }
      )
    );
  }

  const prefix = config.tokenPrefix;
  for (const {symbol, gateway, token, decimals} of config.mintGateways) {
    const existingGateway = Ox(
      await gatewayRegistry.getMintGatewayBySymbol(symbol)
    );
    const existingToken = Ox(await gatewayRegistry.getRenAssetBySymbol(symbol));
    if ((await gatewayRegistry.getGatewayBySymbol(symbol)) === Ox0) {
      const prefixedSymbol = `${prefix}${symbol}`;
      if (!token) {
        console.log(
          `Calling deployMintGatewayAndRenAsset(${symbol}, ${prefixedSymbol}, ${prefixedSymbol}, ${decimals}, '1')`
        );
        await waitForTx(() =>
          gatewayRegistry.deployMintGatewayAndRenAsset(
            symbol,
            prefixedSymbol,
            prefixedSymbol,
            decimals,
            '1',
            {
              ...config.overrides,
            }
          )
        );
      } else {
        console.log(`Calling addMintGateway(${symbol}, ${token}, ${gateway})`);
        await waitForTx(() =>
          gatewayRegistry.addMintGateway(symbol, token, gateway, {
            ...config.overrides,
          })
        );
      }
    } else {
      console.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
    }
  }

  for (const {symbol, gateway, token} of config.lockGateways || []) {
    const existingGateway = Ox(
      await gatewayRegistry.getMintGatewayBySymbol(symbol)
    );
    const existingToken = Ox(
      await gatewayRegistry.getLockAssetBySymbol(symbol)
    );
    if ((await gatewayRegistry.getLockGatewayBySymbol(symbol)) === Ox0) {
      if (!gateway) {
        console.log(`Calling deployLockGateway(${symbol}, ${token}, '1')`);
        await waitForTx(() =>
          gatewayRegistry.deployLockGateway(symbol, token, '1', {
            ...config.overrides,
          })
        );
      } else {
        console.log(`Calling addLockGateway(${symbol}, ${token}, ${gateway})`);
        await waitForTx(() =>
          gatewayRegistry.addLockGateway(symbol, token, gateway, {
            ...config.overrides,
          })
        );
      }
    } else {
      console.log(`Skipping ${symbol} - ${existingGateway}, ${existingToken}!`);
    }
  }

  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'BTC',
  //   'renBTC',
  //   'renBTC',
  //   8,
  //   '1'
  // );
  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'ZEC',
  //   'renZEC',
  //   'renZEC',
  //   8,
  //   '1'
  // );
  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'BCH',
  //   'renBCH',
  //   'renBCH',
  //   8,
  //   '1'
  // );
  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'DGB',
  //   'renDGB',
  //   'renDGB',
  //   8,
  //   '1'
  // );
  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'FIL',
  //   'renFIL',
  //   'renFIL',
  //   18,
  //   '1'
  // );
  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'LUNA',
  //   'renLUNA',
  //   'renLUNA',
  //   6,
  //   '1'
  // );
  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'DOGE',
  //   'renDOGE',
  //   'renDOGE',
  //   8,
  //   '1'
  // );

  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'ETH',
  //   'renETH',
  //   'renETH',
  //   18,
  //   '1'
  // );

  // await gatewayRegistry.deployMintGatewayAndRenAsset(
  //   'DAI',
  //   'renDAI',
  //   'renDAI',
  //   18,
  //   '1'
  // );

  // const usdc = await create2<ERC20PresetMinterPauserUpgradeable>(
  //   'ERC20PresetMinterPauserUpgradeable',
  //   []
  // );
  // await usdc.initialize('USDC', 'USDC');
  // await gatewayRegistry.deployLockGateway('DAI', usdc.address, '1');

  // await usdc.mint(deployer, '100', {from: deployer});

  // const usdcLockGatewayAddress = await gatewayRegistry.getLockGatewayBySymbol(
  //   'USDC'
  // );
  // const usdcGateway = await ethers.getContractAt<LockGatewayV3>(
  //   'LockGatewayV3',
  //   usdcLockGatewayAddress,
  //   deployer
  // );

  // await usdc.approve(usdcGateway.address, '10', {from: deployer});
  // await usdcGateway.lock('8123', 'Bitcoin', [], '10', {from: deployer});

  console.log(
    'mint gateway symbols:',
    await gatewayRegistry.getMintGatewaySymbols(0, 0)
  );
  console.log(
    'lock gateway symbols:',
    await gatewayRegistry.getLockGatewaySymbols(0, 0)
  );

  await create2('BasicBridge', [gatewayRegistry.address]);
};

export default func;

func.tags = [
  'RenAssetV2',
  'RenAssetProxyBeacon',
  'MintGatewayV3',
  'MintGatewayProxyBeacon',
  'LockGatewayV3',
  'LockGatewayProxyBeacon',
  'SignatureVerifierV1',
  'SignatureVerifierProxy',
  'GatewayRegistryV2',
  'BasicBridge',
  'ERC20PresetMinterPauserUpgradeable',
];
