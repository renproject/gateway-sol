// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

/// Library with common String checks.
library String {
    /// Check that the string only contains alphanumeric characters, to avoid
    /// UTF-8 characters that are indistinguishable from alphanumeric
    /// characters.
    function isAlphanumeric(string memory _string) internal pure returns (bool) {
        for (uint256 i = 0; i < bytes(_string).length; i++) {
            uint8 char = uint8(bytes(_string)[i]);
            if (!((char >= 65 && char <= 90) || (char >= 97 && char <= 122) || (char >= 48 && char <= 57))) {
                return false;
            }
        }
        return true;
    }

    /// Check that the string has at least one character.
    function isNotEmpty(string memory _string) internal pure returns (bool) {
        return bytes(_string).length > 0;
    }

    /// Check that the string is not empty and only has alphanumeric characters.
    function isValidString(string memory _string) internal pure returns (bool) {
        return isNotEmpty(_string) && isAlphanumeric(_string);
    }
}
