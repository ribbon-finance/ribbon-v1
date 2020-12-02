// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

enum OptionType {Invalid, Put, Call}

interface ProtocolAdapter {
    function protocolName() external view returns (string memory);

    function nonFungible() external view returns (bool);

    function premium(
        address underlying,
        address strikeAsset,
        address collateral,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 purchaseAmount
    ) external view returns (uint256 cost);

    function exerciseProfit(
        address underlying,
        address strikeAsset,
        address collateral,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 exerciseAmount
    ) external view returns (uint256 profit);

    function purchase(uint256 amount) external payable;

    function exercise(uint256 amount, uint256 optionID) external payable;
}
