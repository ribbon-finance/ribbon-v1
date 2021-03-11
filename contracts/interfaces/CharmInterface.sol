// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOptionFactory {
  function markets() external view returns (address[] memory);
}

interface IOptionMarket {
  function baseToken() external view returns (IERC20);
  function longTokens() external view returns (IOptionToken[] memory);
  function shortTokens() external view returns (IOptionToken[] memory);
  function strikePrices() external view returns (uint256[] memory);
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
}

interface IOptionToken {
  function market() external pure returns (address);
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
