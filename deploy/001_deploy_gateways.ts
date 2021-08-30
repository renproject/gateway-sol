import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {keccak256} from 'ethers/lib/utils';
import {
  GatewayRegistryV2,
  RenAssetProxyBeaconV1,
  MintGatewayProxyBeaconV1,
  LockGatewayProxyBeaconV1,
  SignatureVerifier,
  LockGatewayV3,
  ERC20PresetMinterPauserUpgradeable,
} from '../typechain';
import {BaseContract} from 'ethers';

const CREATE2_SALT = keccak256(Buffer.from('REN-0001'));

const setupCreate2 =
  (hre: HardhatRuntimeEnvironment) =>
  async <T extends BaseContract>(name: string, args: any[]): Promise<T> => {
    const {deployments, getUnnamedAccounts, ethers} = hre;
    const {deploy} = deployments;

    const [deployer] = await getUnnamedAccounts();
    console.log(`Deploying ${name} from ${deployer}`);

    const result = await deploy(name, {
      from: deployer,
      args: args,
      log: true,
      deterministicDeployment: CREATE2_SALT,
    });
    console.log(name, result.address);
    return await ethers.getContractAt<T>(name, result.address, deployer);
  };

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getUnnamedAccounts, ethers} = hre;
  const {deploy} = deployments;

  const create2 = await setupCreate2(hre);

  const [deployer] = await getUnnamedAccounts();

  const chainName = 'Ethereum';
  const chainId = 1;
  const mintAuthority = deployer;

  // Deploy RenAssetProxyBeacon ////////////////////////////////////////////////
  const renAssetImplementation = await deploy('RenAssetV2', {
    from: deployer,
    log: true,
    deterministicDeployment: CREATE2_SALT,
  });
  const renAssetProxyBeacon = await create2<RenAssetProxyBeaconV1>(
    'RenAssetProxyBeaconV1',
    [renAssetImplementation.address, deployer]
  );

  // Deploy MintGatewayProxyBeacon /////////////////////////////////////////////
  const mintGatewayImplementation = await deploy('MintGatewayV3', {
    from: deployer,
    log: true,
    deterministicDeployment: CREATE2_SALT,
  });
  const mintGatewayProxyBeacon = await create2<MintGatewayProxyBeaconV1>(
    'MintGatewayProxyBeaconV1',
    [mintGatewayImplementation.address, deployer]
  );

  // Deploy LockGatewayProxyBeacon /////////////////////////////////////////////
  const lockGatewayImplementation = await deploy('LockGatewayV3', {
    from: deployer,
    log: true,
    deterministicDeployment: CREATE2_SALT,
  });
  const lockGatewayProxyBeacon = await create2<LockGatewayProxyBeaconV1>(
    'LockGatewayProxyBeaconV1',
    [lockGatewayImplementation.address, deployer]
  );

  const signatureVerifier = await create2<SignatureVerifier>(
    'SignatureVerifier',
    []
  );
  signatureVerifier.__SignatureVerifier_init(mintAuthority);

  // Deploy GatewayRegistry ////////////////////////////////////////////////////
  const gatewayRegistry = await create2<GatewayRegistryV2>(
    'GatewayRegistryV2',
    []
  );
  await gatewayRegistry.__GatewayRegistry_init(
    chainName,
    chainId,
    renAssetProxyBeacon.address,
    mintGatewayProxyBeacon.address,
    lockGatewayProxyBeacon.address,
    deployer
  );
  await gatewayRegistry.updateSignatureVerifier(signatureVerifier.address);

  await renAssetProxyBeacon.grantRole(
    await renAssetProxyBeacon.PROXY_DEPLOYER(),
    gatewayRegistry.address
  );
  await mintGatewayProxyBeacon.grantRole(
    await mintGatewayProxyBeacon.PROXY_DEPLOYER(),
    gatewayRegistry.address
  );
  await lockGatewayProxyBeacon.grantRole(
    await lockGatewayProxyBeacon.PROXY_DEPLOYER(),
    gatewayRegistry.address
  );

  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'BTC',
    'renBTC',
    'renBTC',
    8,
    '1'
  );
  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'ZEC',
    'renZEC',
    'renZEC',
    8,
    '1'
  );
  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'BCH',
    'renBCH',
    'renBCH',
    8,
    '1'
  );
  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'DGB',
    'renDGB',
    'renDGB',
    8,
    '1'
  );
  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'FIL',
    'renFIL',
    'renFIL',
    18,
    '1'
  );
  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'LUNA',
    'renLUNA',
    'renLUNA',
    6,
    '1'
  );
  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'DOGE',
    'renDOGE',
    'renDOGE',
    8,
    '1'
  );

  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'UST',
    'renUST',
    'renUST',
    18,
    '1'
  );

  await gatewayRegistry.deployMintGatewayAndRenAsset(
    'USDC',
    'renUSDC',
    'renUSDC',
    2,
    '1'
  );

  const usdc = await create2<ERC20PresetMinterPauserUpgradeable>(
    'ERC20PresetMinterPauserUpgradeable',
    []
  );
  await usdc.initialize('USDC', 'USDC');
  await gatewayRegistry.deployLockGateway('USDC', usdc.address, '1');

  await usdc.mint(deployer, '100', {from: deployer});

  const usdcLockGatewayAddress = await gatewayRegistry.getLockGatewayBySymbol(
    'USDC'
  );
  const usdcGateway = await ethers.getContractAt<LockGatewayV3>(
    'LockGatewayV3',
    usdcLockGatewayAddress,
    deployer
  );

  await usdc.approve(usdcGateway.address, '10', {from: deployer});
  await usdcGateway.lock('8123', 'Bitcoin', [], '10', {from: deployer});

  console.log(
    'mint gateway symbols:',
    await gatewayRegistry.getMintGatewaySymbols(0, 0)
  );
  console.log(
    'lock gateway symbols:',
    await gatewayRegistry.getLockGatewaySymbols(0, 0)
  );

  await deploy('BasicBridge', {
    from: deployer,
    args: [gatewayRegistry.address],
  });
};

export default func;

func.tags = [
  'RenAssetV2',
  'RenAssetProxyBeacon',
  'MintGatewayV3',
  'MintGatewayProxyBeacon',
  'LockGatewayV3',
  'LockGatewayProxyBeacon',
  'SignatureVerifier',
  'GatewayRegistryV2',
  'BasicBridge',
  'ERC20PresetMinterPauserUpgradeable',
];
