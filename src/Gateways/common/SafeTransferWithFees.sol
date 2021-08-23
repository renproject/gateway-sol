// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeTransferWithFees {
    using SafeERC20 for IERC20;

    function safeTransferFromWithFees(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) internal returns (uint256) {
        uint256 balanceBefore = token.balanceOf(to);
        token.safeTransferFrom(from, to, value);
        uint256 balanceAfter = token.balanceOf(to);

        uint256 balanceIncrease = balanceAfter - balanceBefore;

        return Math.min(value, balanceIncrease);
    }
}
