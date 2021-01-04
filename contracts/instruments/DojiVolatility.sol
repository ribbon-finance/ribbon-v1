// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../lib/upgrades/Initializable.sol";
import "../lib/DSMath.sol";
import "../interfaces/InstrumentInterface.sol";
import "../interfaces/HegicInterface.sol";
import "./DojiVolatilityStorage.sol";
import {OptionType, IProtocolAdapter} from "../adapters/IProtocolAdapter.sol";
import "../tests/DebugLib.sol";

contract DojiVolatility is
    Initializable,
    IAggregatedOptionsInstrument,
    ReentrancyGuard,
    DSMath,
    DebugLib,
    DojiVolatilityStorageV1
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event PositionCreated(
        address indexed account,
        uint256 indexed positionID,
        string[] venues,
        OptionType[] optionTypes,
        uint256[] amounts,
        uint32[] optionIDs
    );
    event Exercised(
        address indexed account,
        uint256 indexed positionID,
        uint256 totalProfit,
        bool[] optionsExercised
    );

    receive() external payable {}

    function initialize(
        address _owner,
        address _factory,
        string memory _name,
        string memory _symbol,
        address _underlying,
        address _strikeAsset,
        uint256 _expiry
    ) public initializer {
        require(block.timestamp < _expiry, "Expiry has already passed");

        factory = IDojiFactory(_factory);
        owner = _owner;
        name = _name;
        symbol = _symbol;
        expiry = _expiry;
        underlying = _underlying;
        strikeAsset = _strikeAsset;
    }

    function getPremiumsFromAdapter(
        IProtocolAdapter adapter,
        uint256 strikePrice,
        uint256 optionAmount
    ) private view returns (uint256 callPremium, uint256 putPremium) {
        bool callOptionExists = adapter.optionsExist(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            OptionType.Call
        );
        bool putOptionExists = adapter.optionsExist(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            OptionType.Put
        );

        callPremium = callOptionExists
            ? adapter.premium(
                underlying,
                strikeAsset,
                expiry,
                strikePrice,
                OptionType.Call,
                optionAmount
            )
            : 0;
        putPremium = putOptionExists
            ? adapter.premium(
                underlying,
                strikeAsset,
                expiry,
                strikePrice,
                OptionType.Put,
                optionAmount
            )
            : 0;
    }

    /**
     * @notice Buy instrument and create the underlying options positions
     * @param venues array of venue names, e.g. "HEGIC", "OPYN_V1"
     * @param amounts array of option purchase amounts
     */
    function buyInstrument(
        string[] memory venues,
        OptionType[] memory optionTypes,
        uint256[] memory amounts,
        uint256[] memory strikePrices
    ) public override payable nonReentrant returns (uint256 positionID) {
        require(venues.length >= 2, "Must have at least 2 venues");
        require(block.timestamp < expiry, "Cannot purchase after expiry");

        uint32[] memory optionIDs = new uint32[](venues.length);
        bool seenCall = false;
        bool seenPut = false;

        for (uint256 i = 0; i < venues.length; i++) {
            uint32 optionID = purchaseOptionAtVenue(
                venues[i],
                optionTypes[i],
                amounts[i],
                strikePrices[i]
            );

            if (!seenPut && optionTypes[i] == OptionType.Put) {
                seenPut = true;
            } else if (!seenCall && optionTypes[i] == OptionType.Call) {
                seenCall = true;
            }
            optionIDs[i] = optionID;
        }

        require(seenCall && seenPut, "Must have both put and call options");

        InstrumentPosition memory position = InstrumentPosition(
            false,
            optionTypes,
            optionIDs,
            amounts,
            strikePrices,
            venues
        );
        positionID = instrumentPositions[msg.sender].length;
        instrumentPositions[msg.sender].push(position);

        emit PositionCreated(
            msg.sender,
            positionID,
            venues,
            optionTypes,
            amounts,
            optionIDs
        );
    }

    function purchaseOptionAtVenue(
        string memory venue,
        OptionType optionType,
        uint256 amount,
        uint256 strikePrice
    ) private returns (uint32 optionID) {
        address adapterAddress = factory.getAdapter(venue);
        require(adapterAddress != address(0), "Adapter does not exist");
        IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);

        require(optionType != OptionType.Invalid, "Invalid option type");

        uint256 premium = adapter.premium(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount
        );

        // This only applies to ETH payments for now
        // We have not enabled purchases using the underlying asset.
        if (underlying == address(0)) {
            require(
                address(this).balance >= premium,
                "Value cannot cover premium"
            );
        }

        uint256 optionID256 = adapter.purchase{value: premium}(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount
        );
        optionID = adapter.nonFungible() ? uint32(optionID256) : 0;
    }

    function exercisePosition(uint256 positionID)
        public
        override
        nonReentrant
        returns (uint256 totalProfit)
    {
        InstrumentPosition storage position = instrumentPositions[msg
            .sender][positionID];
        require(!position.exercised, "Already exercised");
        require(block.timestamp <= expiry, "Already expired");

        bool[] memory optionsExercised = new bool[](position.venues.length);

        for (uint256 i = 0; i < position.venues.length; i++) {
            IProtocolAdapter adapter = IProtocolAdapter(
                factory.getAdapter(position.venues[i])
            );
            OptionType optionType = position.optionTypes[i];
            uint256 strikePrice = position.strikePrices[i];

            address optionsAddress = adapter.getOptionsAddress(
                underlying,
                strikeAsset,
                expiry,
                strikePrice,
                optionType
            );
            uint256 profit = adapter.exerciseProfit(
                optionsAddress,
                position.optionIDs[i],
                position.amounts[i]
            );
            if (profit > 0) {
                adapter.exercise(
                    optionsAddress,
                    position.optionIDs[i],
                    position.amounts[i],
                    msg.sender
                );
                optionsExercised[i] = true;
            } else {
                optionsExercised[i] = false;
            }
            totalProfit += profit;
        }
        position.exercised = true;

        emit Exercised(msg.sender, positionID, totalProfit, optionsExercised);
    }

    function dToken() external pure returns (address) {
        return address(0);
    }
}
