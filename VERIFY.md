# Verifying contracts

TODO: Write a script to do this.

```sh
# Proxy Admin
yarn hardhat verify --network goerliTestnet --contract contracts/Governance/RenProxyAdmin.sol:RenProxyAdmin 0xf1DA6f4A594553335EdeA6B1203a4B590c752E32

# Gateway Registry
yarn hardhat verify --network goerliTestnet 0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC

# BasicAdapter
yarn hardhat verify --network goerliTestnet 0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066 0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC

# RenERC20LogicV1
yarn hardhat verify --network goerliTestnet 0xB5072BE373a120d81c728e908Ed0710968fC247f

# MintGatewayLogicV2
yarn hardhat verify --network goerliTestnet 0x5e3c8B0F7229f1F1873267B6811465fEF73d53CA

# RenERC20s and MintGateways
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0x880Ad65DC5B3F33123382416351Eef98B4aAd7F1
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x29Aa535b65b9C9A08bEdEbA8F9398aAf4832F98b

yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0xf98A573BEabDB73a2d8697001bD411c21CBb89b1
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x098ecF3bEb11E308f1B9C38c1E1b50c10FC02af3

yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0xc735241F93F87D4DBEA499EE6e1d41Ec50e3D8cE
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0xe1Ae770a368ef05158c65c572701778575Da85d0

yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0x6268002A734EDcDe6c2111ae339E0D92B1ED2Bfa
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x20471d322f20E3cAE8f8b75D1481B5BD53c41695

yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0x7352e7244899b7Cb5d803CC02741c8910d3B75de
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x0E6bbBb35835cC3624a000e1698B7B68E9eeC7DF

yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0x1156663dFab56A9BAdd844e12eDD69eC96Dd0eFb
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x038b63C120a7e60946d6EbAa6Dcfc3a475108cc9

yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/RenERC20Proxy.sol:RenERC20Proxy 0xA0b04e9D8B883626769Ac23aF4fb019e34B944C4
yarn hardhat verify --network goerliTestnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x75A33b43Af9d532da65750c01F5fAB3c3FC0b8F9

```
