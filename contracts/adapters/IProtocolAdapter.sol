// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

enum OptionType {Invalid, Put, Call}

interface IProtocolAdapter {
    event Purchased(
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

    function protocolName() external pure returns (string memory);

    function nonFungible() external pure returns (bool);

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
        uint256 amount
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
        uint256 amount
    ) external payable;
}
