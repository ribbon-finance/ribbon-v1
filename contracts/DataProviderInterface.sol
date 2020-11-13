// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface DataProviderInterface {
    function getPrice(address _asset) external view returns (uint256);

    function weth() external view returns (address);
}
