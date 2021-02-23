// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {DSMath} from "../lib/DSMath.sol";
import {
    InstrumentStorageV1,
    InstrumentStorageV2,
    Venues
} from "../storage/InstrumentStorage.sol";
import {
    OptionType,
    OptionTerms,
    IProtocolAdapter,
    PurchaseMethod,
    ZeroExOrder
} from "../adapters/IProtocolAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import {Ownable} from "../lib/Ownable.sol";
import "../tests/DebugLib.sol";

contract RibbonVolatility is DSMath, InstrumentStorageV1, InstrumentStorageV2 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ProtocolAdapter for IProtocolAdapter;

    bytes32 private constant hegicHash = keccak256(bytes("HEGIC"));
    bytes32 private constant opynHash = keccak256(bytes("OPYN_GAMMA"));

    event PositionCreated(
        address indexed account,
        uint256 indexed positionID,
        string[] venues,
        OptionType[] optionTypes,
        uint256 amount
    );
    event Exercised(
        address indexed account,
        uint256 indexed positionID,
        uint256 totalProfit,
        bool[] optionsExercised
    );

    event ClaimedRewards(
        uint256 numRewards
    );

    receive() external payable {}

    function initialize(
        address _owner,
        address _factory,
        string memory _name,
        string memory _symbol,
        address _underlying,
        address _strikeAsset,
        address _collateralAsset,
        uint256 _expiry
    ) public initializer {
        require(block.timestamp < _expiry, "Expiry has already passed");

        Ownable.initialize(_owner);
        factory = IRibbonFactory(_factory);
        name = _name;
        symbol = _symbol;
        expiry = _expiry;
        underlying = _underlying;
        strikeAsset = _strikeAsset;
        collateralAsset = _collateralAsset;
    }

    function cost(
        string[] memory venues,
        OptionType[] memory optionTypes,
        uint256[] memory amounts,
        uint256[] memory strikePrices,
        address paymentToken
    ) public view returns (uint256 totalPremium) {
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
                        collateralAsset,
                        expiry,
                        strikePrices[i],
                        optionTypes[i],
                        paymentToken
                    )
                );
            require(exists, "Options does not exist");

            totalPremium += adapter.delegatePremium(
                OptionTerms(
                    underlying,
                    strikeAsset,
                    collateralAsset,
                    expiry,
                    strikePrices[i],
                    optionTypes[i],
                    paymentToken
                ),
                amounts[i]
            );
        }
    }

    function exerciseProfit(address account, uint256 positionID)
        external
        view
        returns (uint256)
    {
        InstrumentPosition storage position =
            instrumentPositions[account][positionID];

        if (position.exercised) return 0;

        uint256 profit = 0;

        uint8[] memory venues = new uint8[](2);
        venues[0] = position.callVenue;
        venues[1] = position.putVenue;

        for (uint256 i = 0; i < venues.length; i++) {
            string memory venue = getAdapterName(venues[i]);
            uint256 amount = position.amount;

            OptionType optionType;
            uint256 strikePrice;
            uint32 optionID;
            if (i == 0) {
                strikePrice = position.callStrikePrice;
                optionID = position.callOptionID;
                optionType = OptionType.Call;
            } else {
                strikePrice = position.putStrikePrice;
                optionID = position.putOptionID;
                optionType = OptionType.Put;
            }

            address adapterAddress = factory.getAdapter(venue);
            require(adapterAddress != address(0), "Adapter does not exist");
            IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);
            address options =
                adapter.getOptionsAddress(
                    OptionTerms(
                        underlying,
                        strikeAsset,
                        collateralAsset,
                        expiry,
                        strikePrice,
                        optionType,
                        address(0) // paymentToken is not used at all nor stored in storage
                    )
                );

            bool exercisable = adapter.canExercise(options, optionID, amount);
            if (!exercisable) {
                continue;
            }

            profit += adapter.delegateExerciseProfit(options, optionID, amount);
        }
        return profit;
    }

    function canExercise(address account, uint256 positionID)
        external
        view
        returns (bool)
    {
        InstrumentPosition storage position =
            instrumentPositions[account][positionID];

        if (position.exercised) return false;

        bool eitherOneCanExercise = false;

        uint8[] memory venues = new uint8[](2);
        venues[0] = position.callVenue;
        venues[1] = position.putVenue;

        for (uint256 i = 0; i < venues.length; i++) {
            string memory venue = getAdapterName(venues[i]);
            uint256 strikePrice;
            uint32 optionID;
            OptionType optionType;
            if (i == 0) {
                strikePrice = position.callStrikePrice;
                optionID = position.callOptionID;
                optionType = OptionType.Call;
            } else {
                strikePrice = position.putStrikePrice;
                optionID = position.putOptionID;
                optionType = OptionType.Put;
            }

            address adapterAddress = factory.getAdapter(venue);
            require(adapterAddress != address(0), "Adapter does not exist");
            IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);
            address options =
                adapter.getOptionsAddress(
                    OptionTerms(
                        underlying,
                        strikeAsset,
                        collateralAsset,
                        expiry,
                        strikePrice,
                        optionType,
                        address(0) // paymentToken is not used nor stored in storage
                    )
                );

            bool canExerciseOptions =
                adapter.canExercise(options, optionID, position.amount);

            if (canExerciseOptions) {
                eitherOneCanExercise = true;
            }
        }
        return eitherOneCanExercise;
    }

    /**
     * @notice Buy instrument and create the underlying options positions
     * @param venues array of venue names, e.g. "HEGIC", "OPYN_V1"
     * @param amount amount of contracts to purchase
     */
    function buyInstrument(
        string[] memory venues,
        OptionType[] memory optionTypes,
        uint256 amount,
        uint256[] memory strikePrices,
        bytes[] memory buyData,
        address paymentToken, 
        uint256[] memory maxCosts
    ) public payable nonReentrant returns (uint256 positionID) {
        require(venues.length >= 2, "Must have 2 or more venue");
        require(optionTypes.length >= 2, "Must have 2 or more optionTypes");
        require(strikePrices.length >= 2, "Must have 2 or more strikePrices");
        require(buyData.length >= 2, "Must have 2 or more buyData");
        require(block.timestamp < expiry, "Cannot purchase after expiry");

        factory.burnGasTokens();

        bool seenCall = false;
        bool seenPut = false;

        InstrumentPosition memory position;
        position.exercised = false;
        position.amount = amount;

        for (uint256 i = 0; i < venues.length; i++) {
            uint32 optionID =
                purchaseOptionAtVenue(
                    venues[i],
                    optionTypes[i],
                    amount,
                    strikePrices[i],
                    buyData[i],
                    paymentToken,
                    maxCosts[i]
                );

            if (!seenPut && optionTypes[i] == OptionType.Put) {
                position.callVenue = uint8(getVenueID(venues[i]));
                position.callStrikePrice = strikePrices[i];
                position.callOptionID = optionID;
                seenPut = true;
            } else if (!seenCall && optionTypes[i] == OptionType.Call) {
                position.putVenue = uint8(getVenueID(venues[i]));
                position.putStrikePrice = strikePrices[i];
                position.putOptionID = optionID;
                seenCall = true;
            }
        }

        positionID = instrumentPositions[msg.sender].length;
        instrumentPositions[msg.sender].push(position);

        uint balance = address(this).balance;
        if(balance > 0) payable(msg.sender).transfer(balance);

        emit PositionCreated(
            msg.sender,
            positionID,
            venues,
            optionTypes,
            amount
        );
    }

    function purchaseOptionAtVenue(
        string memory venue,
        OptionType optionType,
        uint256 amount,
        uint256 strikePrice,
        bytes memory buyData,
        address paymentToken,
        uint256 maxCost
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
                strikePrice,
                paymentToken,
                maxCost
            );
        } else if (purchaseMethod == PurchaseMethod.ZeroEx) {
            purchaseWithZeroEx(adapter, optionType, strikePrice, buyData);
        }
    }

    function purchaseWithContract(
        IProtocolAdapter adapter,
        OptionType optionType,
        uint256 amount,
        uint256 strikePrice,
        address paymentToken,
        uint256 maxCost
    ) private returns (uint32 optionID) {
        OptionTerms memory optionTerms =
            OptionTerms(
                underlying,
                strikeAsset,
                collateralAsset,
                expiry,
                strikePrice,
                optionType,
                paymentToken
            );

        uint256 optionID256 = adapter.delegatePurchase(optionTerms, amount, maxCost);
        optionID = uint32(optionID256);
    }

    function purchaseWithZeroEx(
        IProtocolAdapter adapter,
        OptionType optionType,
        uint256 strikePrice,
        bytes memory buyData,
        address paymentToken
    ) private {
        OptionTerms memory optionTerms =
            OptionTerms(
                underlying,
                strikeAsset,
                collateralAsset,
                expiry,
                strikePrice,
                optionType,
                address(0)
            );

        ZeroExOrder memory zeroExOrder = abi.decode(buyData, (ZeroExOrder));

        adapter.delegatePurchaseWithZeroEx(optionTerms, zeroExOrder);
    }

    function exercisePosition(uint256 positionID)
        public
        nonReentrant
        returns (uint256 totalProfit)
    {
        InstrumentPosition storage position =
            instrumentPositions[msg.sender][positionID];
        require(!position.exercised, "Already exercised");

        bool[] memory optionsExercised = new bool[](2);
        uint8[] memory venues = new uint8[](2);
        venues[0] = position.callVenue;
        venues[1] = position.putVenue;

        for (uint256 i = 0; i < venues.length; i++) {
            string memory adapterName = getAdapterName(venues[i]);
            IProtocolAdapter adapter =
                IProtocolAdapter(factory.getAdapter(adapterName));

            OptionType optionType;
            uint256 strikePrice;
            uint32 optionID;
            if (i == 0) {
                strikePrice = position.callStrikePrice;
                optionID = position.callOptionID;
                optionType = OptionType.Call;
            } else {
                strikePrice = position.putStrikePrice;
                optionID = position.putOptionID;
                optionType = OptionType.Put;
            }
            
            address paymentToken = address(0); // it is irrelevant at this stage 

            address optionsAddress =
                adapter.getOptionsAddress(
                    OptionTerms(
                        underlying,
                        strikeAsset,
                        collateralAsset,
                        expiry,
                        strikePrice,
                        optionType,
                        paymentToken
                    )
                );

            require(optionsAddress != address(0), "Options address must exist");

            uint256 amount = position.amount;

            uint256 profit =
                adapter.delegateExerciseProfit(
                    optionsAddress,
                    optionID,
                    amount
                );
            if (profit > 0) {
                adapter.delegateExercise(
                    optionsAddress,
                    optionID,
                    amount,
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

    function claimRewards(string calldata adapterName, address rewardsAddress, uint256[] calldata optionIDs)
        external
    {
      IProtocolAdapter adapter = IProtocolAdapter(factory.getAdapter(adapterName));
      adapter.delegateClaimRewards(rewardsAddress, optionIDs);
      emit ClaimedRewards(optionIDs.length);
    }

    function getAdapterName(uint8 venueID)
        private
        pure
        returns (string memory)
    {
        if (venueID == uint8(Venues.Hegic)) {
            return "HEGIC";
        } else if (venueID == uint8(Venues.OpynGamma)) {
            return "OPYN_GAMMA";
        }
        return "";
    }

    function getVenueID(string memory venueName) private pure returns (Venues) {
        if (keccak256(bytes(venueName)) == hegicHash) {
            return Venues.Hegic;
        } else if (keccak256(bytes(venueName)) == opynHash) {
            return Venues.OpynGamma;
        }
        return Venues.Unknown;
    }
}
