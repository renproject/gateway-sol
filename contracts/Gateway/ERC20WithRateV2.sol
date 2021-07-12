pragma solidity ^0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

import "../Governance/Claimable.sol";

/// @notice ERC20WithRate allows for a more dynamic fee model by storing a rate
/// that tracks the number of the underlying asset's unit represented by a
/// single ERC20 token.
contract ERC20WithRateV2 is Initializable, Ownable, ERC20 {
    uint256 public constant _rateScale = 1e18;
    uint256 internal _rate;
}
