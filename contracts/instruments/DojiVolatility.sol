// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
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
        uint256 totalProfit
    );

    receive() external payable {}

    function initialize(
        address _owner,
        address _factory,
        string memory _name,
        string memory _symbol,
        address _underlying,
        address _strikeAsset,
        uint256 _expiry,
        uint256 _callStrikePrice,
        uint256 _putStrikePrice
    ) public initializer {
        require(block.timestamp < _expiry, "Expiry has already passed");

        factory = IDojiFactory(_factory);
        owner = _owner;
        name = _name;
        _symbol = _symbol;
        expiry = _expiry;
        callStrikePrice = _callStrikePrice;
        putStrikePrice = _putStrikePrice;
        underlying = _underlying;
        strikeAsset = _strikeAsset;
    }

    function getBestTrade(uint256 optionAmount)
        public
        override
        view
        returns (
            string[] memory venues,
            uint8[] memory optionTypes,
            uint256[] memory amounts,
            uint256[] memory premiums
        )
    {
        address[] memory adapters = factory.getAdapters();
        uint256 cheapestCallPremium;
        uint256 cheapestPutPremium;
        string memory callVenue;
        string memory putVenue;

        for (uint256 i = 0; i < adapters.length; i++) {
            IProtocolAdapter adapter = IProtocolAdapter(adapters[i]);
            (uint256 callPremium, uint256 putPremium) = getPremiumsFromAdapter(
                adapter,
                optionAmount
            );

            if (callPremium != 0) {
                if (
                    cheapestCallPremium == 0 ||
                    callPremium < cheapestCallPremium
                ) {
                    cheapestCallPremium = callPremium;
                    callVenue = adapter.protocolName();
                }
            }
            if (putPremium != 0) {
                if (
                    cheapestPutPremium == 0 || putPremium < cheapestPutPremium
                ) {
                    cheapestPutPremium = callPremium;
                    putVenue = adapter.protocolName();
                }
            }
        }
        require(
            bytes(callVenue).length >= 1 && bytes(putVenue).length >= 1,
            "No matching venues"
        );

        venues = new string[](2);
        venues[0] = putVenue;
        venues[1] = callVenue;

        optionTypes = new uint8[](2);
        optionTypes[0] = uint8(OptionType.Put);
        optionTypes[1] = uint8(OptionType.Call);

        amounts = new uint256[](2);
        amounts[0] = optionAmount;
        amounts[1] = optionAmount;

        premiums = new uint256[](2);
        premiums[0] = cheapestPutPremium;
        premiums[1] = cheapestCallPremium;
    }

    function getPremiumsFromAdapter(
        IProtocolAdapter adapter,
        uint256 optionAmount
    ) private view returns (uint256 callPremium, uint256 putPremium) {
        bool callOptionExists = adapter.optionsExist(
            underlying,
            strikeAsset,
            expiry,
            callStrikePrice,
            OptionType.Call
        );
        bool putOptionExists = adapter.optionsExist(
            underlying,
            strikeAsset,
            expiry,
            putStrikePrice,
            OptionType.Put
        );

        callPremium = callOptionExists
            ? adapter.premium(
                underlying,
                strikeAsset,
                expiry,
                callStrikePrice,
                OptionType.Call,
                optionAmount
            )
            : 0;
        putPremium = putOptionExists
            ? adapter.premium(
                underlying,
                strikeAsset,
                expiry,
                putStrikePrice,
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
        uint256[] memory amounts
    ) public override payable nonReentrant returns (uint256 positionID) {
        require(venues.length >= 2, "Must have at least 2 venues");
        uint32[] memory optionIDs = new uint32[](venues.length);
        bool seenCall = false;
        bool seenPut = false;

        for (uint256 i = 0; i < venues.length; i++) {
            uint32 optionID = purchaseOptionAtVenue(
                venues[i],
                optionTypes[i],
                amounts[i]
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
        uint256 amount
    ) private returns (uint32 optionID) {
        address adapterAddress = factory.getAdapter(venue);
        require(adapterAddress != address(0), "Adapter does not exist");
        IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);

        require(optionType != OptionType.Invalid, "Invalid option type");
        uint256 strikePrice = optionType == OptionType.Put
            ? putStrikePrice
            : callStrikePrice;

        uint256 premium = adapter.premium(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount
        );

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

    function exercise(uint256 positionID)
        public
        override
        nonReentrant
        returns (uint256 totalProfit)
    {
        InstrumentPosition[] storage positions = instrumentPositions[msg
            .sender];
        InstrumentPosition storage position = positions[positionID];
        // InstrumentPosition storage position = positions[positionID];
        require(!position.exercised, "Already exercised");
        require(block.timestamp <= expiry, "Already expired");

        for (uint256 i = 0; i < position.venues.length; i++) {
            IProtocolAdapter adapter = IProtocolAdapter(
                factory.getAdapter(position.venues[i])
            );
            OptionType optionType = position.optionTypes[i];
            uint256 strikePrice = optionType == OptionType.Put
                ? putStrikePrice
                : callStrikePrice;
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
                position.amounts[i],
                underlying
            );
            if (profit > 0) {
                adapter.exercise(
                    optionsAddress,
                    position.optionIDs[i],
                    position.amounts[i],
                    underlying,
                    msg.sender
                );
            }
            totalProfit += profit;
        }

        position.exercised = true;
        // (bool success, ) = msg.sender.call{value: profit}("");
        // require(success, "Transferring profit failed");
        // emit Exercised(msg.sender, positionID, profit);
    }

    function dToken() external pure returns (address) {
        return address(0);
    }
}
