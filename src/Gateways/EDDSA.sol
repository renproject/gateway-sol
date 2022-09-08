// SPDX-License-Identifier: GPL-3.0

// solhint-disable-next-line
pragma solidity ^0.8.0;

library EDDSA {
    struct PubKey {
        uint256 x;
        uint8 parity;
    }

    function p() public pure returns (uint256) {
        return 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
    }

    function n() public pure returns (uint256) {
        return 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    }

    function lessThanP(uint256 _num) public pure returns (bool) {
        return _num < p();
    }

    function lessThanN(uint256 _num) public pure returns (bool) {
        return _num < n();
    }

    function verify(
        PubKey memory pubKey,
        bytes32 sigHash,
        bytes memory signature
    ) internal pure returns (bool) {
        require(signature.length == 96, "EDDSA: Invalid signature length");

        uint256 rx;
        uint256 ry;
        uint256 s;

        assembly {
            rx := mload(add(signature, 0x20))
            ry := mload(add(signature, 0x40))
            s := mload(add(signature, 0x60))
        }

        require(lessThanP(rx), "EDDSA: Invalid RX");
        require(lessThanP(ry), "EDDSA: Invalid RY");
        require(lessThanN(s), "EDDSA: Invalid S");

        uint8 rParity = uint8(ry) & 0x01;

        bytes memory buf = bytes.concat(
            bytes1(rParity),
            abi.encodePacked(rx),
            bytes1(pubKey.parity),
            abi.encodePacked(pubKey.x),
            sigHash
        );

        uint256 e = abi.decode(abi.encodePacked(sha256(buf)), (uint256));

        address q = ecrecover(
            bytes32(n() - mulmod(s, pubKey.x, n())),
            27 + pubKey.parity,
            bytes32(pubKey.x),
            bytes32(n() - mulmod(e, pubKey.x, n()))
        );

        return q == address(uint160(uint256(keccak256(bytes.concat(abi.encodePacked(rx, ry))))));
    }
}
