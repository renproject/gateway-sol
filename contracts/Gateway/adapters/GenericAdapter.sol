pragma solidity ^0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";

import "../interfaces/IGateway.sol";
import "../interfaces/IGatewayRegistry.sol";

contract GenericAdapter is Ownable, IERC721Receiver {
    using SafeMath for uint256;

    IGatewayRegistry registry;

    constructor(IGatewayRegistry _registry) public {
        Ownable.initialize(msg.sender);
        registry = _registry;
    }

    function arbitraryCall(address _contract, bytes calldata _contractParams)
        internal
    {
        (bool success, bytes memory result) = _contract.call(_contractParams);
        if (!success) {
            // Check if the call result was too short to be a revert reason.
            if (result.length < 68) {
                revert(
                    "GenericAdapter: contract call failed without revert reason"
                );
            }
            // Return the call's revert reason.
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    // Allow the owner to recover tokens and collectibles stuck in the contract.
    // This contract is not meant to hold funds.
    function _recover(address _contract, bytes calldata _contractParams)
        public
        onlyOwner
    {
        arbitraryCall(_contract, _contractParams);
    }

    function directMint(
        // Payload
        string calldata _symbol,
        address _account,
        uint256 _submitterFee,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        // Allow the account to submit without a fee.
        if (_account == msg.sender) {
            _submitterFee = 0;
        }

        // Calculate the payload hash for the first six parameters.
        bytes32 payloadHash =
            keccak256(abi.encode(_symbol, _account, _submitterFee));

        // Call `mint` on the Gateway contract.
        uint256 amount =
            registry.getGatewayBySymbol(_symbol).mint(
                payloadHash,
                _amount,
                _nHash,
                _sig
            );

        IERC20 token = registry.getTokenBySymbol(_symbol);
        token.transfer(_account, _amount.sub(_submitterFee));

        // Pay fee as last step.
        if (_submitterFee > 0) {
            token.transfer(msg.sender, _submitterFee);
        }
    }

    // Track the caller in case there's ERC721
    address currentAccount;

    function genericCall(
        // Payload
        string calldata _symbol,
        address _account,
        address _contract,
        bytes calldata _contractParams,
        IERC20[] calldata _refundTokens,
        uint256 _submitterFee,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        address previousAccount = currentAccount;
        currentAccount = _account;

        // Allow the account to submit without a fee.
        if (_account == msg.sender) {
            _submitterFee = 0;
        }

        // Calculate the payload hash for the first six parameters.
        bytes32 payloadHash =
            keccak256(
                abi.encode(
                    _symbol,
                    _account,
                    _contract,
                    _contractParams,
                    _refundTokens,
                    _submitterFee
                )
            );

        // Call `mint` on the Gateway contract.
        uint256 amount =
            registry.getGatewayBySymbol(_symbol).mint(
                payloadHash,
                _amount,
                _nHash,
                _sig
            );

        IERC20 token = registry.getTokenBySymbol(_symbol);

        // Approval the amount excluding the fee.
        uint256 oldApproval = token.allowance(address(this), _contract);
        token.approve(_contract, oldApproval.add(_amount.sub(_submitterFee)));

        // Call contract with the contract parameters.
        arbitraryCall(_contract, _contractParams);

        // Revoke approval.
        token.approve(_contract, oldApproval);

        // The user must specify which tokens may potentially be recieved during
        // the contract call. Note that if one of the matched refund tokens
        // match `token` and a fee is paid out later on, the transaction will
        // revert.
        for (uint256 i = 0; i < _refundTokens.length; i++) {
            IERC20 refundToken = IERC20(_refundTokens[i]);
            uint256 refundBalance = refundToken.balanceOf(address(this));
            if (refundBalance > 0) {
                refundToken.transfer(currentAccount, refundBalance);
            }
        }

        // Return any remaining `token` balance.
        uint256 tokenBalance = token.balanceOf(address(this));
        if (tokenBalance > _submitterFee) {
            token.transfer(currentAccount, tokenBalance.sub(_submitterFee));
        }

        // Pay fee as last step.
        if (_submitterFee > 0) {
            token.transfer(msg.sender, _submitterFee);
        }

        // Reset `currentAccount`.
        currentAccount = previousAccount;

        // Return the result of the arbitrary contract call.
        return result;
    }

    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes
    ) public returns (bytes4) {
        // Forward on to current account.
        IERC721(msg.sender).safeTransferFrom(
            address(this),
            currentAccount,
            tokenId
        );
        return this.onERC721Received.selector;
    }
}
