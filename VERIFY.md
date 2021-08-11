# Verifying contracts

TODO: Write a script to do this.

```sh
# Proxy Admin
yarn hardhat verify --network polygonMainnet 0xbdf27A048Ea859A20Fef6B956eaeeA4e80F2Bdc7

# Gateway Registry
yarn hardhat verify --network polygonMainnet 0x21C482f153D0317fe85C60bE1F7fa079019fcEbD

# BasicAdapter
yarn hardhat verify --network polygonMainnet 0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5 0x21C482f153D0317fe85C60bE1F7fa079019fcEbD

# RenERC20LogicV1
yarn hardhat verify --network polygonMainnet 0x3799006a87FDE3CCFC7666B3E6553B03ED341c2F

# MintGatewayLogicV2
yarn hardhat verify --network polygonMainnet 0x6b8bB175c092DE7d81860B18DB360B734A2598e0

# RenERC20s
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0xDBf31dF14B66535aF65AaC99C32e9eA844e14501
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0x31a0D1A199631D244761EEba67e8501296d2E383
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0xc3fEd6eB39178A541D274e6Fc748d48f0Ca01CC3
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0xc4Ace9278e7E01755B670C0838c3106367639962
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0x2628568509E87c4429fBb5c664Ed11391BE1BD29
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0xcE829A89d4A55a63418bcC43F00145adef0eDB8E
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/RenERC20.sol:RenERC20Proxy 0x7c7DAAF2dB46fEFd067f002a69FD0BE14AeB159f

# MintGateways
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x05Cadbf3128BcB7f2b89F3dD55E5B0a036a49e20
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x7986568375Af35B427f3f51389d73196967C356a
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x06A2C5d79c66268610eEBBca10AFa17092860830
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x4d59f628CB8e4670b779eAE22aF0c46DebC06695
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x677b23D0ffc82414B063accA197f74d791285952
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x9FB2C0b19A9fee6d02E7Ea861C71503608B64d6A
yarn hardhat verify --network polygonMainnet --contract contracts/Gateway/MintGatewayV2.sol:MintGatewayProxy 0x731Ea4Ba77fF184d89dBeB160A0078274Acbe9D2
```
