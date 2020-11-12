// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "../DataProviderInterface.sol";

contract MockDataProvider is DataProviderInterface {
    mapping(address => uint256) prices;

    address private _weth;

    constructor(address weth) public {
        _weth = weth;
    }

    function weth() external override view returns (address) {
        return _weth;
    }

    function getPrice(address _asset) external override view returns (uint256) {
        return prices[_asset];
    }

    function setPrice(address _asset, uint256 _price) public {
        prices[_asset] = _price;
    }
}
