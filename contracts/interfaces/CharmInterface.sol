// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOptionMarket {
    function baseToken() external view returns (IERC20);

    function longTokens(uint256 index) external view returns (IOptionToken);

    function shortTokens(uint256 index) external view returns (IOptionToken);

    function strikePrices(uint256 index) external view returns (uint256);

    function expiryTime() external view returns (uint256);

    function isPut() external view returns (bool);

    function isSettled() external view returns (bool);

    function buy(
        bool isLongToken,
        uint256 strikeIndex,
        uint256 optionsOut,
        uint256 maxAmountIn
    ) external payable returns (uint256);

    function sell(
        bool isLongToken,
        uint256 strikeIndex,
        uint256 optionsIn,
        uint256 minAmountOut
    ) external returns (uint256);

    function settle() external;

    function isExpired() external view returns (bool);

    function numStrikes() external view returns (uint256);
}

interface IOptionToken {
    function market() external pure returns (address);

    function decimals() external view returns (uint8);
}

interface IOptionViews {
    function getBuyOptionCost(
        IOptionMarket market,
        bool isLongToken,
        uint256 strikeIndex,
        uint256 optionsOut
    ) external view returns (uint256);

    function getSellOptionCost(
        IOptionMarket market,
        bool isLongToken,
        uint256 strikeIndex,
        uint256 optionsIn
    ) external view returns (uint256);
}

interface IOptionRegistry {
    struct OptionDetails {
        bool isLongToken;
        uint256 strikeIndex;
        uint256 strikePrice;
    }

    function getOption(
        IERC20 underlying,
        uint256 expiryTime,
        bool isPut,
        uint256 strikePrice,
        bool isLong
    ) external view returns (IOptionToken);

    function getOptionDetails(IOptionToken optionToken)
        external
        view
        returns (OptionDetails memory);

    function populateMarkets() external;
}
