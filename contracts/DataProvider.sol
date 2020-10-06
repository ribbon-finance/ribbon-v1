// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract DataProvider is Ownable {
    /**
     * @notice Mapping of token address to address of its' Chainlink feed.
     * These Chainlink feeds are Token/ETH feeds.
     */
    mapping(address => address) public chainlinkRegistry;

    /**
     * @notice Adds Chainlink feed to chainlinkRegistry
     * @param _asset is the address of the asset contract
     */
    function addChainlinkFeed(address _asset, address _feed) public onlyOwner {
        chainlinkRegistry[_asset] = _feed;
    }

    /**
     * @notice Gets the latest price of an asset from a chainlink feed
     */
    function getLatestChainlinkPrice(address _feed) public view returns (int) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_feed);
        (
            uint80 roundID, 
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Round not complete");
        return price;
    }
}