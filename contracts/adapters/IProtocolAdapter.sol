// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

enum OptionType {Invalid, Put, Call}

interface IProtocolAdapter {
    event Purchased(
        address indexed caller,
        string indexed protocolName,
        address indexed underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 amount,
        uint256 premium,
        uint256 optionID
    );

    event Exercised(
        address indexed caller,
        address indexed options,
        uint256 indexed optionID,
        uint256 amount,
        uint256 exerciseProfit
    );

    function protocolName() external pure returns (string memory);

    function nonFungible() external pure returns (bool);

    function optionsExist(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) external view returns (bool);

    function getOptionsAddress(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) external view returns (address);

    function premium(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 purchaseAmount
    ) external view returns (uint256 cost);

    function exerciseProfit(
        address options,
        uint256 optionID,
        uint256 amount,
        address underlying,
        uint256 strikePrice
    ) external view returns (uint256 profit);

    function purchase(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 amount
    ) external payable returns (uint256 optionID);

    function exercise(
        address options,
        uint256 optionID,
        uint256 amount,
        address underlying,
        address account
    ) external payable;
}
