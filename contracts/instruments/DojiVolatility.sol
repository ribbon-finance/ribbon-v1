// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {DSMath} from "../lib/DSMath.sol";
import {
    IAggregatedOptionsInstrument
} from "../interfaces/InstrumentInterface.sol";
import {InstrumentStorageV1} from "../storage/InstrumentStorage.sol";
import {
    OptionType,
    OptionTerms,
    IProtocolAdapter,
    PurchaseMethod,
    ZeroExOrder
} from "../adapters/IProtocolAdapter.sol";
import {IDojiFactory} from "../interfaces/IDojiFactory.sol";
import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import "../tests/DebugLib.sol";

contract DojiVolatility is
    IAggregatedOptionsInstrument,
    DSMath,
    DebugLib,
    InstrumentStorageV1
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ProtocolAdapter for IProtocolAdapter;

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

    function cost(
        string[] memory venues,
        OptionType[] memory optionTypes,
        uint256[] memory amounts,
        uint256[] memory strikePrices
    ) public view override returns (uint256 totalPremium) {
        for (uint256 i = 0; i < venues.length; i++) {
            address adapterAddress = factory.getAdapter(venues[i]);
            require(adapterAddress != address(0), "Adapter does not exist");
            IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);

            if (adapter.purchaseMethod() == PurchaseMethod.ZeroEx) {
                continue;
            }

            bool exists =
                adapter.delegateOptionsExist(
                    OptionTerms(
                        underlying,
                        strikeAsset,
                        strikeAsset,
                        expiry,
                        strikePrices[i],
                        optionTypes[i]
                    )
                );
            require(exists, "Options does not exist");

            totalPremium += adapter.delegatePremium(
                OptionTerms(
                    underlying,
                    strikeAsset,
                    strikeAsset,
                    expiry,
                    strikePrices[i],
                    optionTypes[i]
                ),
                amounts[i]
            );
        }
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
        uint256[] memory strikePrices,
        bytes[] memory buyData
    ) public payable override nonReentrant returns (uint256 positionID) {
        require(venues.length >= 2, "Must have at least 2 venues");
        require(block.timestamp < expiry, "Cannot purchase after expiry");

        uint32[] memory optionIDs = new uint32[](venues.length);
        bool seenCall = false;
        bool seenPut = false;

        for (uint256 i = 0; i < venues.length; i++) {
            uint32 optionID =
                purchaseOptionAtVenue(
                    venues[i],
                    optionTypes[i],
                    amounts[i],
                    strikePrices[i],
                    buyData[i]
                );

            if (!seenPut && optionTypes[i] == OptionType.Put) {
                seenPut = true;
            } else if (!seenCall && optionTypes[i] == OptionType.Call) {
                seenCall = true;
            }
            optionIDs[i] = optionID;
        }

        require(seenCall && seenPut, "Must have both put and call options");

        InstrumentPosition memory position =
            InstrumentPosition(
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
        uint256 strikePrice,
        bytes memory buyData
    ) private returns (uint32 optionID) {
        address adapterAddress = factory.getAdapter(venue);
        require(adapterAddress != address(0), "Adapter does not exist");
        IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);

        require(optionType != OptionType.Invalid, "Invalid option type");

        PurchaseMethod purchaseMethod = adapter.purchaseMethod();

        require(
            purchaseMethod != PurchaseMethod.Invalid,
            "Invalid purchase method"
        );

        if (purchaseMethod == PurchaseMethod.Contract) {
            optionID = purchaseWithContract(
                adapter,
                optionType,
                amount,
                strikePrice
            );
        } else if (purchaseMethod == PurchaseMethod.ZeroEx) {
            purchaseWithZeroEx(adapter, optionType, strikePrice, buyData);
        }
    }

    function purchaseWithContract(
        IProtocolAdapter adapter,
        OptionType optionType,
        uint256 amount,
        uint256 strikePrice
    ) private returns (uint32 optionID) {
        OptionTerms memory optionTerms =
            OptionTerms(
                underlying,
                strikeAsset,
                strikeAsset,
                expiry,
                strikePrice,
                optionType
            );

        uint256 premium = adapter.delegatePremium(optionTerms, amount);

        // This only applies to ETH payments for now
        // We have not enabled purchases using the underlying asset.
        if (underlying == address(0)) {
            require(
                address(this).balance >= premium,
                "Value cannot cover premium"
            );
        }

        uint256 optionID256 = adapter.delegatePurchase(optionTerms, amount);
        optionID = adapter.delegateNonFungible() ? uint32(optionID256) : 0;
    }

    function purchaseWithZeroEx(
        IProtocolAdapter adapter,
        OptionType optionType,
        uint256 strikePrice,
        bytes memory buyData
    ) private {
        OptionTerms memory optionTerms =
            OptionTerms(
                underlying,
                strikeAsset,
                strikeAsset,
                expiry,
                strikePrice,
                optionType
            );

        ZeroExOrder memory zeroExOrder = abi.decode(buyData, (ZeroExOrder));

        adapter.delegatePurchaseWithZeroEx(optionTerms, zeroExOrder);
    }

    function exercisePosition(uint256 positionID)
        public
        override
        nonReentrant
        returns (uint256 totalProfit)
    {
        InstrumentPosition storage position =
            instrumentPositions[msg.sender][positionID];
        require(!position.exercised, "Already exercised");
        require(block.timestamp <= expiry, "Already expired");

        bool[] memory optionsExercised = new bool[](position.venues.length);

        for (uint256 i = 0; i < position.venues.length; i++) {
            IProtocolAdapter adapter =
                IProtocolAdapter(factory.getAdapter(position.venues[i]));
            OptionType optionType = position.optionTypes[i];
            uint256 strikePrice = position.strikePrices[i];

            address optionsAddress =
                adapter.delegateGetOptionsAddress(
                    OptionTerms(
                        underlying,
                        strikeAsset,
                        strikeAsset,
                        expiry,
                        strikePrice,
                        optionType
                    )
                );
            uint256 profit =
                adapter.delegateExerciseProfit(
                    optionsAddress,
                    position.optionIDs[i],
                    position.amounts[i]
                );
            if (profit > 0) {
                adapter.delegateExercise(
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
