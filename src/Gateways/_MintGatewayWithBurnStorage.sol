// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {MintGatewayV3} from "./MintGateway.sol";
import {RenAssetV1} from "../RenAsset/RenAsset.sol";

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract MintGatewayWithBurnStorageV3 is MintGatewayV3 {
    uint256 public nextN;

    struct Burn {
        uint256 _blocknumber;
        bytes _to;
        uint256 _amount;
        // Optional
        string _chain;
        bytes _payload;
    }

    mapping(uint256 => Burn) internal burns;

    function __MintGatewayWithBurnStorage_init(
        string calldata chain_,
        string calldata asset_,
        address signatureVerifier_,
        address token
    ) public initializer {
        MintGatewayV3.__MintGateway_init(chain_, asset_, signatureVerifier_, token);
    }

    function burn(bytes memory recipient_, uint256 amount_) public override returns (uint256) {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(bytes(recipient_).length != 0, "MintGateway: to address is empty");

        // Burn the tokens. If the user doesn't have enough tokens, this will
        // throw.
        RenAssetV1(token).burn(msg.sender, amount_);

        emit LogBurn(bytes(recipient_), amount_, nextN, bytes(recipient_));

        burns[nextN] = Burn({_blocknumber: block.number, _to: recipient_, _amount: amount_, _chain: "", _payload: ""});

        nextN += 1;

        return amount_;
    }
}