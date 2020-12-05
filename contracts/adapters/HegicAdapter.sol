// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IProtocolAdapter, OptionType} from "./IProtocolAdapter.sol";
import {
    IHegicOptions,
    HegicOptionType,
    IHegicETHOptions,
    IHegicBTCOptions
} from "../interfaces/HegicInterface.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BaseProtocolAdapter} from "./BaseProtocolAdapter.sol";

contract HegicAdapter is
    IProtocolAdapter,
    ReentrancyGuard,
    BaseProtocolAdapter
{
    using SafeMath for uint256;

    string private constant _name = "HEGIC";
    bool private constant _nonFungible = true;
    address public immutable ethAddress;
    address public immutable wbtcAddress;
    IHegicETHOptions public immutable ethOptions;
    IHegicBTCOptions public immutable wbtcOptions;

    constructor(
        address _ethOptions,
        address _wbtcOptions,
        address _ethAddress,
        address _wbtcAddress
    ) public {
        ethOptions = IHegicETHOptions(_ethOptions);
        wbtcOptions = IHegicBTCOptions(_wbtcOptions);
        ethAddress = _ethAddress;
        wbtcAddress = _wbtcAddress;
    }

    receive() external payable {}

    function protocolName() public override pure returns (string memory) {
        return _name;
    }

    function nonFungible() external override pure returns (bool) {
        return _nonFungible;
    }

    function premium(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 purchaseAmount
    ) public override view returns (uint256 cost) {
        require(block.timestamp < expiry, "Cannot purchase after expiry");
        uint256 period = expiry - block.timestamp;

        if (underlying == ethAddress) {
            (cost, , , ) = ethOptions.fees(
                period,
                purchaseAmount,
                strikePrice,
                HegicOptionType(uint8(optionType))
            );
        } else if (underlying == wbtcAddress) {
            (, cost, , , ) = wbtcOptions.fees(
                period,
                purchaseAmount,
                strikePrice,
                HegicOptionType(uint8(optionType))
            );
        } else {
            require(false, "No matching underlying");
        }
    }

    function exerciseProfit(
        address optionsAddress,
        uint256 optionID,
        uint256 exerciseAmount
    ) public override view returns (uint256 profit) {
        require(
            optionsAddress == address(ethOptions) ||
                optionsAddress == address(wbtcOptions),
            "optionsAddress must match either ETH or WBTC options"
        );
        IHegicOptions options = IHegicOptions(optionsAddress);

        AggregatorV3Interface priceProvider = AggregatorV3Interface(
            options.priceProvider()
        );
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        uint256 currentPrice = uint256(latestPrice);

        (
            ,
            ,
            uint256 strike,
            uint256 amount,
            uint256 lockedAmount,
            ,
            ,
            HegicOptionType optionType
        ) = options.options(optionID);

        if (optionType == HegicOptionType.Call) {
            if (currentPrice >= strike) {
                profit = currentPrice.sub(strike).mul(amount).div(currentPrice);
            } else {
                profit = 0;
            }
        } else {
            if (currentPrice <= strike) {
                profit = strike.sub(currentPrice).mul(amount).div(currentPrice);
            } else {
                profit = 0;
            }
        }
        if (profit > lockedAmount) profit = lockedAmount;
    }

    function purchase(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 amount
    )
        external
        override
        payable
        nonReentrant
        onlyInstrument
        returns (uint256 optionID)
    {
        IHegicOptions options = getHegicOptions(underlying);
        require(block.timestamp < expiry, "Cannot purchase after expiry");

        uint256 period = expiry - block.timestamp;
        uint256 cost = premium(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount
        );
        require(msg.value >= cost, "Value does not cover cost");

        optionID = options.create{value: cost}(
            period,
            amount,
            strikePrice,
            HegicOptionType(uint8(optionType))
        );

        emit Purchased(
            msg.sender,
            _name,
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount,
            cost,
            optionID
        );
    }

    function exercise(
        address optionsAddress,
        uint256 optionID,
        uint256 amount
    ) external override payable onlyInstrument nonReentrant {
        require(
            optionsAddress == address(ethOptions) ||
                optionsAddress == address(wbtcOptions),
            "optionsAddress must match either ETH or WBTC options"
        );

        uint256 profit = exerciseProfit(optionsAddress, optionID, amount);
        IHegicOptions options = IHegicOptions(optionsAddress);
        options.exercise(optionID);
        (bool success, ) = msg.sender.call{value: profit}("");
        require(success, "Failed transfer");
        emit Exercised(msg.sender, optionsAddress, optionID, amount, 0);
    }

    function getHegicOptions(address underlying)
        private
        view
        returns (IHegicOptions)
    {
        if (underlying == ethAddress) {
            return ethOptions;
        } else if (underlying == wbtcAddress) {
            return wbtcOptions;
        }
        require(false, "No matching options contract");
    }
}
