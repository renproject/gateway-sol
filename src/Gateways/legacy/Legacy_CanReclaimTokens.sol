// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Legacy_Claimable.sol";

contract Legacy_CanReclaimTokens is Legacy_Claimable {
    using SafeERC20 for ERC20;

    mapping(address => bool) private recoverableTokensBlacklist;

    function initialize(address _nextOwner) public initializer {
        Legacy_Claimable.initialize(_nextOwner);
    }

    function blacklistRecoverableToken(address _token) public onlyOwner {
        recoverableTokensBlacklist[_token] = true;
    }

    /// @notice Allow the owner of the contract to recover funds accidentally
    /// sent to the contract. To withdraw ETH, the token should be set to `0x0`.
    function recoverTokens(address _token) external onlyOwner {
        require(!recoverableTokensBlacklist[_token], "CanReclaimTokens: token is not recoverable");

        if (_token == address(0x0)) {
            msg.sender.transfer(address(this).balance);
        } else {
            ERC20(_token).safeTransfer(msg.sender, ERC20(_token).balanceOf(address(this)));
        }
    }
}
