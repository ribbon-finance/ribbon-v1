// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "../DataProviderInterface.sol";

contract MockDataProvider is DataProviderInterface{
    mapping(address => uint) prices;

    function getPrice(address _asset) external view override returns (uint) {
        return prices[_asset];
    }

    function setPrice(address _asset, uint _price) public {
        prices[_asset] = _price;
    }
}