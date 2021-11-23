// SPDX-License-Identifier: GPL-3.0

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

pragma solidity ^0.8.7;

/// TransferWithLog is a replacement for a standard ETH transfer, with an added
/// log to make it easily searchable.
contract TransferWithLog is Context {
    string public constant NAME = "TransferWithLog";

    event LogTransferred(address indexed from, address indexed to, uint256 amount);

    function transferWithLog(address payable to) external payable {
        require(to != address(0x0), "TransferWithLog: invalid empty recipient");
        uint256 amount = msg.value;
        // `call` is used instead of `transfer` or `send` to avoid a hard-coded
        // gas limit.
        // See https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "TransferWithLog: transfer failed");
        emit LogTransferred(_msgSender(), to, amount);
    }
}
