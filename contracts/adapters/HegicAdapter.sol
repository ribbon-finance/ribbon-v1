// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
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
import "../tests/DebugLib.sol";

contract HegicAdapter is
    IProtocolAdapter,
    ReentrancyGuard,
    BaseProtocolAdapter,
    DebugLib
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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

    function initialize(address _owner, address _dojiFactory)
        public
        initializer
    {
        owner = _owner;
        dojiFactory = _dojiFactory;
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
        uint256 period = expiry.sub(block.timestamp);
        uint256 scaledStrikePrice = scaleDownStrikePrice(strikePrice);

        if (underlying == ethAddress) {
            (cost, , , ) = ethOptions.fees(
                period,
                purchaseAmount,
                scaledStrikePrice,
                HegicOptionType(uint8(optionType))
            );
        } else if (underlying == wbtcAddress) {
            (, cost, , , ) = wbtcOptions.fees(
                period,
                purchaseAmount,
                scaledStrikePrice,
                HegicOptionType(uint8(optionType))
            );
        } else {
            require(false, "No matching underlying");
        }
    }

    function exerciseProfit(
        address optionsAddress,
        uint256 optionID,
        uint256 exerciseAmount,
        address underlying
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
        require(block.timestamp < expiry, "Cannot purchase after expiry");
        uint256 cost = premium(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount
        );
        optionID = _purchase(
            underlying,
            cost,
            expiry,
            amount,
            strikePrice,
            optionType
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

    function _purchase(
        address underlying,
        uint256 cost,
        uint256 expiry,
        uint256 amount,
        uint256 strikePrice,
        OptionType optionType
    ) private returns (uint256 optionID) {
        uint256 scaledStrikePrice = scaleDownStrikePrice(strikePrice);
        uint256 period = expiry.sub(block.timestamp);
        IHegicOptions options = getHegicOptions(underlying);
        require(msg.value >= cost, "Value does not cover cost");

        optionID = options.create{value: cost}(
            period,
            amount,
            scaledStrikePrice,
            HegicOptionType(uint8(optionType))
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

        address underlying = optionsAddress == address(ethOptions)
            ? ethAddress
            : wbtcAddress;

        uint256 profit = exerciseProfit(
            optionsAddress,
            optionID,
            amount,
            underlying
        );
        IHegicOptions options = IHegicOptions(optionsAddress);
        options.exercise(optionID);

        if (optionsAddress == address(ethOptions)) {
            (bool success, ) = msg.sender.call{value: profit}("");
            require(success, "Failed transfer");
        } else {
            IERC20 wbtc = IERC20(wbtcAddress);
            wbtc.safeTransfer(msg.sender, profit);
        }

        emit Exercised(msg.sender, optionsAddress, optionID, amount, profit);
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

    function scaleDownStrikePrice(uint256 strikePrice)
        private
        pure
        returns (uint256)
    {
        // converts strike price in 10**18 to 10**8
        return strikePrice.div(10**10);
    }
}
