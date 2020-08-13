const config = {
    mintAuthority: "", // RenVM public key
    mintFee: 10,
    burnFee: 10,
    renBTCMinimumBurnAmount: 10000,
    renZECMinimumBurnAmount: 10000,
    renBCHMinimumBurnAmount: 10000,

    // Overwritten by each network configuration.
    tokenPrefix: "mock",
}

module.exports = {
    mainnet: {
        RenProxyAdmin: "0xDf1D8eD27C54bBE5833320cf5a19fd9E73530145",

        GatewayRegistry: "0xe80d347DF1209a76DD9d2319d62912ba98C54DDD",
        BasicAdapter: "0x32666B64e9fD0F44916E1378Efb2CFa3B3B96e80",

        RenERC20LogicV1: "0xe2d6cCAC3EE3A21AbF7BeDBE2E107FfC0C037e80",
        GatewayLogicV1: "0x402ec534BaF9e8Dd2968c57fDea368f3856460d6",

        // BTC
        renBTC: "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D",
        BTCGateway: "0xe4b679400F0f267212D5D812B95f58C83243EE71",

        // ZEC
        renZEC: "0x1C5db575E2Ff833E46a2E9864C22F4B22E0B37C2",
        ZECGateway: "0xc3BbD5aDb611dd74eCa6123F05B18acc886e122D",

        renBCH: "0x459086F2376525BdCebA5bDDA135e4E9d3FeF5bf",
        BCHGateway: "0xCc4FF5b8A4A7adb35F00ff0CBf53784e07c3C52F",

        config: {
            ...config,
            feeRecipient: "0xE33417797d6b8Aec9171d0d6516E88002fbe23E7",
            mintAuthority: "0x7f64e4e4b2d7589eb0ac8439c0e639856aeceee7",

            tokenPrefix: "ren",
        },
    },
    chaosnet: {
        RenProxyAdmin: "0x3840c01167cf06C3101762f0Fce991BEfA1CdFAF",

        GatewayRegistry: "0x817d2E41dABbA7A5e840353c9D73A40674ED3400",
        BasicAdapter: "0x0807d0810714d85B49E40349a3002F06e841B7c3",

        RenERC20LogicV1: "0x0A2d368E4EeCBd515033BA29253909F2978C1Bee",
        GatewayLogicV1: "0x85BdE74CA4760587eC9d77f775Cb83d4Cb76e5ae",

        // BTC
        renBTC: "0x93E47eC9B8cD1a669C7267E20ACF1F6a9c5340Ba",
        BTCGateway: "0xD4d496632b9aF3122FB5DdbF0614aA82effa9F99",

        // ZEC
        renZEC: "0x82E728594b87318e513931469A30713FEF966c8E",
        ZECGateway: "0x37A4860728E292E5852B215c46DBE7a18862EF93",

        // BCH
        renBCH: "0xa2F0a92396cb245BaD15BA77817E1620c58bf05b",
        BCHGateway: "0xc3AC15BEc6dA89e8DC5c4d1b4d0C785547676e3a",

        config: {
            ...config,
            feeRecipient: "0x9C5B076dE6c5c01c9E1ac4cB5b48fB681384742B",
            mintAuthority: "0x1D1A5e08Cb784BA16d69F25551Aea5C49482505c",

            tokenPrefix: "chaos",
        },
    },
    testnet: {
        RenProxyAdmin: "0x4C695C4Aa6238f0A7092733180328c2E64C912C7",

        GatewayRegistry: "0x557e211EC5fc9a6737d2C6b7a1aDe3e0C11A8D5D",
        BasicAdapter: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",

        RenERC20LogicV1: "0xCe77c29b479bDF510f39bc4A2e43B0E4344fAB0f",
        GatewayLogicV1: "0x080d856994Fed1124c93AcA580aF035a86e9e9c7",

        // BTC
        renBTC: "0x0A9ADD98C076448CBcFAcf5E457DA12ddbEF4A8f",
        BTCGateway: "0x55363c0dBf97Ff9C0e31dAfe0fC99d3e9ce50b8A",

        // ZEC
        renZEC: "0x42805DA220DF1f8a33C16B0DF9CE876B9d416610",
        ZECGateway: "0xAACbB1e7bA99F2Ed6bd02eC96C2F9a52013Efe2d",

        // BCH
        renBCH: "0x618dC53e856b1A601119F2Fed5F1E873bCf7Bd6e",
        BCHGateway: "0x9827c8a66a2259fd926E7Fd92EA8DF7ed1D813b1",

        config: {
            ...config,
            feeRecipient: "0x0EC73cCDCd8e643d909D0c4b663Eb1B2Fb0b1e1C",
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",

            tokenPrefix: "test",
        },
    },

    devnet: {
        RenProxyAdmin: "0xA2C9D593bC096FbB3Cf5b869270645C470E5416B",

        GatewayRegistry: "0x5F051E588f39D95bc6c1742f6FA98B103aa0E5c8",
        BasicAdapter: "0xFABDB1F53Ef8B080332621cBc9F820a39e7A1B83",

        RenERC20LogicV1: "0xE121991B5DAB075E33C30E5C36EB5FFa9B2Af1A4",
        GatewayLogicV1: "0xcADcCC772991d8c49c6242604d334f8a0B07A039",

        renBTC: "0x581347fc652f9FCdbCA8372A4f65404C4154e93b",
        BTCGateway: "0xb4fc6D131A44A3b44668E997Ce0CE00A52D4D9ed",

        renZEC: "0x6f35D542f3E0886281fb6152010fb52aC6B931F6",
        ZECGateway: "0x3E31c6E07Eb4C471A6443e90E304E9C68dcdEd7d",

        renBCH: "0x148234809A551c131951bD01640494eecB905b08",
        BCHGateway: "0x86efB11aF3f2c3E3df525a851e3F28E03F4Dcb17",

        config: {
            ...config,
            feeRecipient: "0xfb98D6900330844CeAce6Ae4ae966D272bE1aeC3",
            mintAuthority: "0x1B9d58208879AA9aa9E10040b34cF2b684237621",

            tokenPrefix: "dev",
        },
    },

    localnet: {
        RenProxyAdmin: "0xC822a36df55b8f88E48417A4765C7Fe27170D8eC",

        GatewayRegistry: "0x1832eb340d558a3c05C48247C6dF862Fde863ebB",
        BasicAdapter: "0xD98d8EFF683129d040357439AbA49577452ECcaA",

        RenERC20LogicV1: "0x4337DBfAC0348cd81c167CdB382d0c0B43e60187",
        GatewayLogicV1: "0xb862cE796ac356E4F26507Fa297D5D07Ee4EC8EB",

        renBTC: "0x74D4d4528E948bCebAE54810F2100B9278cb8dEc",
        BTCGateway: "0xA86B7E2C8f45334EE63A379c6C84EAC539d98acA",

        renZEC: "0x1c2B80b7444FC6235DE9ABdf68900E4EDb2b2617",
        ZECGateway: "0x36e668b46DF1b4DfFb843FF8dbb6DBf7200AEAC9",

        renBCH: "0xDF75fb289007DEedcd60f34a069D2941D3448E22",
        BCHGateway: "0xEA96469Cd32D00b2EA1B00d9796e70b71134eD3f",

        config: {
            ...config,
            feeRecipient: "0x45378fF097d385a342557D291dE59f44f4250982",
            mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",

            tokenPrefix: "local",
        },
    },


    bnbTestnet: {
        RenProxyAdmin: "0x07F10424272579865249809BE7EB211f314d8B79",

        GatewayRegistry: "0xf1DA6f4A594553335EdeA6B1203a4B590c752E32",
        BasicAdapter: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",

        RenERC20LogicV1: "0x29Aa535b65b9C9A08bEdEbA8F9398aAf4832F98b",
        GatewayLogicV1: "0xE6ae7439F5fb463B5247E5aF5CC9425D9d3c5a95",

        // BTC
        renBTC: "0x23e66DEcBd099AEf2521e97035F76Bf0c44B8249",
        BTCGateway: "0xEF685D1D44EA983927D9F8D67F77894fAEC92FCF",

        // ZEC
        renZEC: "0x15f692D6B9Ba8CEC643C7d16909e8acdEc431bF6",
        ZECGateway: "0x49fa7a3B9705Fa8DEb135B7bA64C2Ab00Ab915a1",

        // BCH
        renBCH: "0xe1Ae770a368ef05158c65c572701778575Da85d0",
        BCHGateway: "0x32924e6EE523d99C683BA4b100580591Cd2a5fC9",

        config: {
            ...config,
            feeRecipient: "", // defaults to deployer
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",

            tokenPrefix: "test",
        },
    },

    celoTestnet: {
        RenProxyAdmin: "0xf1DA6f4A594553335EdeA6B1203a4B590c752E32",

        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",

        RenERC20LogicV1: "0xB5072BE373a120d81c728e908Ed0710968fC247f",
        GatewayLogicV1: "0x5e3c8B0F7229f1F1873267B6811465fEF73d53CA",

        // BTC
        renBTC: "0x07F10424272579865249809BE7EB211f314d8B79",
        BTCGateway: "0x3645115A577Ea62b0E305Be4329Eb7816Ae056eA",

        // ZEC
        renZEC: "0xEF685D1D44EA983927D9F8D67F77894fAEC92FCF",
        ZECGateway: "0xF9fAE250B8dda539B9AFfEb606C8e2631976413E",

        // BCH
        renBCH: "0x49fa7a3B9705Fa8DEb135B7bA64C2Ab00Ab915a1",
        BCHGateway: "0xc735241F93F87D4DBEA499EE6e1d41Ec50e3D8cE",

        config: {
            ...config,
            feeRecipient: "", // defaults to deployer
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",

            tokenPrefix: "test",
        },
    },

    config,
}