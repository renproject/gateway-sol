// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

import "./Legacy_Claimable.sol";
import "./Legacy_CanReclaimTokens.sol";
import "./Legacy_ERC20WithRateV2.sol";
import "./Legacy_ERC20WithPermit.sol";

contract Legacy_RenERC20LogicV2 is
    Initializable,
    ERC20,
    ERC20Detailed,
    Legacy_ERC20WithRateV2,
    Legacy_ERC20WithPermit,
    Legacy_Claimable,
    Legacy_CanReclaimTokens
{
    /* solium-disable-next-line no-empty-blocks */
    function initialize(
        uint256 _chainId,
        address _nextOwner,
        string memory _version,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public initializer {
        ERC20Detailed.initialize(_name, _symbol, _decimals);
        Legacy_ERC20WithPermit.initialize(_chainId, _version, _name, _symbol, _decimals);
        Legacy_Claimable.initialize(_nextOwner);
        Legacy_CanReclaimTokens.initialize(_nextOwner);
    }

    // function updateSymbol(string memory symbol) public onlyOwner {
    //     ERC20Detailed._symbol = symbol;
    // }

    /// @notice mint can only be called by the tokens' associated Gateway
    /// contract. See Gateway's mint function instead.
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    /// @notice burn can only be called by the tokens' associated Gateway
    /// contract. See Gateway's burn functions instead.
    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        // Disallow sending tokens to the ERC20 contract address - a common
        // mistake caused by the Ethereum transaction's `to` needing to be
        // the token's address.
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public returns (bool) {
        // Disallow sending tokens to the ERC20 contract address (see comment
        // in `transfer`).
        require(recipient != address(this), "RenERC20: can't transfer to token address");
        return super.transferFrom(sender, recipient, amount);
    }
}
