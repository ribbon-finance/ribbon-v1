// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {
    IProtocolAdapter,
    OptionTerms,
    OptionType,
    ZeroExOrder
} from "./IProtocolAdapter.sol";

library ProtocolAdapter {
    function delegateProtocolName(IProtocolAdapter adapter)
        external
        view
        returns (string memory)
    {
        (bool success, bytes memory result) =
            address(adapter).staticcall(
                abi.encodeWithSignature("protocolName()")
            );
        require(success, "protocolName staticcall failed");
        return abi.decode(result, (string));
    }

    function delegateNonFungible(IProtocolAdapter adapter)
        external
        view
        returns (bool)
    {
        (bool success, bytes memory result) =
            address(adapter).staticcall(
                abi.encodeWithSignature("nonFungible()")
            );
        require(success, "nonFungible staticcall failed");
        return abi.decode(result, (bool));
    }

    function delegateOptionsExist(
        IProtocolAdapter adapter,
        OptionTerms calldata optionTerms
    ) external view returns (bool) {
        (bool success, bytes memory result) =
            address(adapter).staticcall(
                abi.encodeWithSignature(
                    "optionsExist((address,address,address,uint256,uint256,uint8))",
                    optionTerms
                )
            );
        require(success, "optionsExist staticcall failed");
        return abi.decode(result, (bool));
    }

    function delegateGetOptionsAddress(
        IProtocolAdapter adapter,
        OptionTerms calldata optionTerms
    ) external view returns (address) {
        (bool success, bytes memory result) =
            address(adapter).staticcall(
                abi.encodeWithSignature(
                    "getOptionsAddress((address,address,address,uint256,uint256,uint8))",
                    optionTerms
                )
            );
        require(success, "getOptionsAddress staticcall failed");
        return abi.decode(result, (address));
    }

    function delegatePremium(
        IProtocolAdapter adapter,
        OptionTerms calldata optionTerms,
        uint256 purchaseAmount
    ) external view returns (uint256) {
        (bool success, bytes memory result) =
            address(adapter).staticcall(
                abi.encodeWithSignature(
                    "premium((address,address,address,uint256,uint256,uint8),uint256)",
                    optionTerms,
                    purchaseAmount
                )
            );
        require(success, "premium staticcall failed");
        return abi.decode(result, (uint256));
    }

    function delegateExerciseProfit(
        IProtocolAdapter adapter,
        address options,
        uint256 optionID,
        uint256 amount
    ) external view returns (uint256) {
        (bool success, bytes memory result) =
            address(adapter).staticcall(
                abi.encodeWithSignature(
                    "exerciseProfit(address,uint256,uint256)",
                    options,
                    optionID,
                    amount
                )
            );
        require(success, "exerciseProfit staticcall failed");
        return abi.decode(result, (uint256));
    }

    function delegatePurchase(
        IProtocolAdapter adapter,
        OptionTerms calldata optionTerms,
        uint256 purchaseAmount
    ) external returns (uint256) {
        (bool success, bytes memory result) =
            address(adapter).delegatecall(
                abi.encodeWithSignature(
                    "purchase((address,address,address,uint256,uint256,uint8),uint256)",
                    optionTerms,
                    purchaseAmount
                )
            );
        require(success, getRevertMsg(result));
        return abi.decode(result, (uint256));
    }

    function delegatePurchaseWithZeroEx(
        IProtocolAdapter adapter,
        OptionTerms calldata optionTerms,
        ZeroExOrder calldata zeroExOrder
    ) external {
        (bool success, bytes memory result) =
            address(adapter).delegatecall(
                abi.encodeWithSignature(
                    "purchase((address,address,address,uint256,uint256,uint8),(address,address,address,address,uint256,uint256,uint256,bytes))",
                    optionTerms,
                    zeroExOrder
                )
            );
        require(success, getRevertMsg(result));
    }

    function delegateExercise(
        IProtocolAdapter adapter,
        address options,
        uint256 optionID,
        uint256 amount,
        address recipient
    ) external {
        (bool success, ) =
            address(adapter).delegatecall(
                abi.encodeWithSignature(
                    "exercise(address,uint256,uint256,address)",
                    options,
                    optionID,
                    amount,
                    recipient
                )
            );
        require(success, "exercise delegatecall failed");
    }

    function getRevertMsg(bytes memory _returnData)
        internal
        pure
        returns (string memory)
    {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}
