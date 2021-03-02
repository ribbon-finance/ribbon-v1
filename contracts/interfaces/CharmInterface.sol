// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;


interface ICharmOptionMarket {
   function getCurrentCost() external view returns(uint256);
}