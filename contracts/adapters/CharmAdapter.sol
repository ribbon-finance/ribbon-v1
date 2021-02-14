// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;
import {
    OptionType,
    IProtocolAdapter,
    OptionTerms,
    ZeroExOrder,
    PurchaseMethod
} from "./IProtocolAdapter.sol";

contract CharmAdapter is IProtocolAdapter {
    string private constant _name = "CHARM";
    bool private constant _nonFungible = false;

    receive() external payable {}

    function protocolName() external pure override returns (string memory) {
        return _name;
    }

    function nonFungible() external pure override returns (bool) {
        return _nonFungible;
    }

    function purchaseMethod() external pure override returns (PurchaseMethod) {
        return PurchaseMethod.Contract;
    }

    /**
     * @notice Check if an options contract exist based on the passed parameters.
     * @param optionTerms is the terms of the option contract
     */
    function optionsExist(OptionTerms calldata optionTerms)
        external
        view
        override
        returns (bool)
    {
        return false;
    }

    /**
     * @notice Get the options contract's address based on the passed parameters
     * @param optionTerms is the terms of the option contract
     */
    function getOptionsAddress(OptionTerms calldata optionTerms)
        external
        view
        override
        returns (address)
    {
        return address(0);
    }

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     * @param optionTerms is the terms of the option contract
     * @param purchaseAmount is the purchase amount in Wad units (10**18)
     */
    function premium(OptionTerms calldata optionTerms, uint256 purchaseAmount)
        external
        view
        override
        returns (uint256 cost)
    {
        return 0;
    }

    /**
     * @notice Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.
     * @param options is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     */
    function exerciseProfit(
        address options,
        uint256 optionID,
        uint256 amount
    ) public view override returns (uint256 profit) {
        return 0;
    }

    function canExercise(
        address options,
        uint256 optionID,
        uint256 amount
    ) public view override returns (bool) {
        return false;
    }

    /**
     * @notice Purchases the options contract.
     * @param optionTerms is the terms of the option contract
     * @param amount is the purchase amount in Wad units (10**18)
     */
    function purchase(OptionTerms calldata optionTerms, uint256 amount)
        external
        payable
        override
        returns (uint256 optionID)
    {}

    function purchaseWithZeroEx(
        OptionTerms calldata optionTerms,
        ZeroExOrder calldata zeroExOrder
    ) external payable {}

    /**
     * @notice Exercises the options contract.
     * @param options is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     * @param recipient is the account that receives the exercised profits. This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address options,
        uint256 optionID,
        uint256 amount,
        address recipient
    ) public payable override {}
}
