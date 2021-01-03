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

contract HegicAdapterStorageV1 {}

contract HegicAdapter is
    IProtocolAdapter,
    ReentrancyGuard,
    BaseProtocolAdapter,
    HegicAdapterStorageV1,
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

    /**
     * @notice constructor for the HegicAdapter
     * @param _ethOptions is the contract address for the mainnet HegicETHOptions
     * @param _wbtcOptions is the contract address for the mainnet HegicWBTCOptions
     * @param _ethAddress is the contract address for Ethereum, defaults to zero address
     * @param _wbtcOptions is the contract address for mainnet WBTC
     */
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

    /**
     * @notice Proxy initializer for HegicAdapter
     * @param _owner is the owner of the contract
     * @param _dojiFactory is the factory used to look up deployed instruments
     */
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

    /**
     * @notice Check if an options contract exist based on the passed parameters.
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
    function optionsExist(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) external override view returns (bool) {
        return underlying == ethAddress || underlying == wbtcAddress;
    }

    /**
     * @notice Get the options contract's address based on the passed parameters
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
    function getOptionsAddress(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) external override view returns (address) {
        if (underlying == ethAddress) {
            return address(ethOptions);
        } else if (underlying == wbtcAddress) {
            return address(wbtcOptions);
        }
        require(false, "No options found");
    }

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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

    /**
     * @notice Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.
     * @param optionsAddress is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param exerciseAmount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     */
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

    /**
     * @notice Purchases the options contract.
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     * @param amount is the purchase amount in Wad units (10**18)
     */
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
        totalOptions[msg.sender] += amount;

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

    /**
     * @notice Implementation of creating a Hegic options position
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param cost is the premium paid to create a position
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param amount is the purchase amount in Wad units (10**18)
     * @param strikePrice is the strike price of the optionContract in Wad units
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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

    /**
     * @notice Exercises the options contract.
     * @param optionsAddress is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     * @param account is the account that receives the exercised profits. This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address optionsAddress,
        uint256 optionID,
        uint256 amount,
        address account
    ) external override payable onlyInstrument nonReentrant {
        require(
            optionsAddress == address(ethOptions) ||
                optionsAddress == address(wbtcOptions),
            "optionsAddress must match either ETH or WBTC options"
        );

        IHegicOptions options = IHegicOptions(optionsAddress);
        (, , , uint256 optionAmount, , , , ) = options.options(optionID);
        require(
            optionAmount <= totalOptions[msg.sender],
            "Cannot exercise over capacity"
        );

        uint256 profit = exerciseProfit(optionsAddress, optionID, amount);
        options.exercise(optionID);

        if (optionsAddress == address(ethOptions)) {
            (bool success, ) = account.call{value: profit}("");
            require(success, "Failed transfer");
        } else {
            IERC20 wbtc = IERC20(wbtcAddress);
            wbtc.safeTransfer(account, profit);
        }

        totalOptions[msg.sender] -= optionAmount;

        emit Exercised(account, optionsAddress, optionID, amount, profit);
    }

    /**
     * @notice Helper function to get the options address based on the underlying asset
     * @param underlying is the underlying asset for the options
     */
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

    /**
     * @notice Helper function to scale down strike prices from 10**18 to 10**8
     * @param strikePrice is the strikePrice in 10**18
     */
    function scaleDownStrikePrice(uint256 strikePrice)
        private
        pure
        returns (uint256)
    {
        // converts strike price in 10**18 to 10**8
        return strikePrice.div(10**10);
    }
}
