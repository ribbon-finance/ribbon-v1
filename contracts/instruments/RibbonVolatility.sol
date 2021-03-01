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

    event ClaimedRewards(uint256 numRewards);

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
        venues[0] = position.putVenue;
        venues[1] = position.callVenue;

        for (uint256 i = 0; i < venues.length; i++) {
            string memory venue = getAdapterName(venues[i]);
            uint256 amount = position.amount;

            OptionType optionType;
            uint256 strikePrice;
            uint32 optionID;
            if (i == 0) {
                strikePrice = position.putStrikePrice;
                optionID = position.putOptionID;
                optionType = OptionType.Put;
            } else {
                strikePrice = position.callStrikePrice;
                optionID = position.callOptionID;
                optionType = OptionType.Call;
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
        venues[0] = position.putVenue;
        venues[1] = position.callVenue;

        for (uint256 i = 0; i < venues.length; i++) {
            string memory venue = getAdapterName(venues[i]);
            uint256 strikePrice;
            uint32 optionID;
            OptionType optionType;
            if (i == 0) {
                strikePrice = position.putStrikePrice;
                optionID = position.putOptionID;
                optionType = OptionType.Put;
            } else {
                strikePrice = position.callStrikePrice;
                optionID = position.callOptionID;
                optionType = OptionType.Call;
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

    struct BuyInstrumentParams {
        uint8 callVenue;
        uint8 putVenue;
        address paymentToken;
        uint256 callStrikePrice;
        uint256 putStrikePrice;
        uint256 amount;
        uint256 callMaxCost;
        uint256 putMaxCost;
        bytes callBuyData;
        bytes putBuyData;
    }

    function buyInstrument(BuyInstrumentParams calldata params)
        external
        payable
        nonReentrant
        returns (uint256 positionID)
    {
        require(block.timestamp < expiry, "Cannot purchase after expiry");

        factory.burnGasTokens();

        string memory callVenueName = getAdapterName(params.callVenue);
        string memory putVenueName = getAdapterName(params.putVenue);

        uint32 putOptionID =
            purchaseOptionAtVenue(
                putVenueName,
                OptionType.Put,
                params.amount,
                params.putStrikePrice,
                params.putBuyData,
                params.paymentToken,
                params.putMaxCost
            );
        uint32 callOptionID =
            purchaseOptionAtVenue(
                callVenueName,
                OptionType.Call,
                params.amount,
                params.callStrikePrice,
                params.callBuyData,
                params.paymentToken,
                params.callMaxCost
            );

        InstrumentPosition memory position =
            InstrumentPosition(
                false,
                params.callVenue,
                params.putVenue,
                callOptionID,
                putOptionID,
                params.amount,
                params.callStrikePrice,
                params.putStrikePrice
            );

        positionID = instrumentPositions[msg.sender].length;
        instrumentPositions[msg.sender].push(position);

        uint256 balance = address(this).balance;
        if (balance > 0) payable(msg.sender).transfer(balance);
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

        uint256 _expiry = expiry;

        Venues venueID = getVenueID(venue);

        if (venueID == Venues.OpynGamma) {
            purchaseWithZeroEx(
                adapter,
                optionType,
                strikePrice,
                buyData,
                _expiry
            );
        } else if (venueID == Venues.Hegic) {
            optionID = purchaseWithContract(
                adapter,
                optionType,
                amount,
                strikePrice,
                paymentToken,
                maxCost,
                _expiry
            );
        } else {
            revert("Venue not supported");
        }
    }

    function purchaseWithContract(
        IProtocolAdapter adapter,
        OptionType optionType,
        uint256 amount,
        uint256 strikePrice,
        address paymentToken,
        uint256 maxCost,
        uint256 _expiry
    ) private returns (uint32 optionID) {
        OptionTerms memory optionTerms =
            OptionTerms(
                underlying,
                strikeAsset,
                collateralAsset,
                _expiry,
                strikePrice,
                optionType,
                paymentToken
            );

        uint256 optionID256 =
            adapter.delegatePurchase(optionTerms, amount, maxCost);
        optionID = uint32(optionID256);
    }

    function purchaseWithZeroEx(
        IProtocolAdapter adapter,
        OptionType optionType,
        uint256 strikePrice,
        bytes memory buyData,
        uint256 _expiry
    ) private {
        OptionTerms memory optionTerms =
            OptionTerms(
                underlying,
                strikeAsset,
                collateralAsset,
                _expiry,
                strikePrice,
                optionType,
                address(0)
            );

        ZeroExOrder memory zeroExOrder = abi.decode(buyData, (ZeroExOrder));

        adapter.delegatePurchaseWithZeroEx(optionTerms, zeroExOrder);
    }

    function exercisePosition(uint256 positionID)
        external
        nonReentrant
        returns (uint256 totalProfit)
    {
        InstrumentPosition storage position =
            instrumentPositions[msg.sender][positionID];
        require(!position.exercised, "Already exercised");

        bool[] memory optionsExercised = new bool[](2);
        uint8[] memory venues = new uint8[](2);
        venues[0] = position.putVenue;
        venues[1] = position.callVenue;

        for (uint256 i = 0; i < venues.length; i++) {
            string memory adapterName = getAdapterName(venues[i]);
            IProtocolAdapter adapter =
                IProtocolAdapter(factory.getAdapter(adapterName));

            OptionType optionType;
            uint256 strikePrice;
            uint32 optionID;
            if (i == 0) {
                strikePrice = position.putStrikePrice;
                optionID = position.putOptionID;
                optionType = OptionType.Put;
            } else {
                strikePrice = position.callStrikePrice;
                optionID = position.callOptionID;
                optionType = OptionType.Call;
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

    function claimRewards(address rewardsAddress) external {
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter("HEGIC"));
        uint256[] memory optionIDs = getOptionIDs(msg.sender);
        uint256 claimedRewards =
            adapter.delegateClaimRewards(rewardsAddress, optionIDs);
        emit ClaimedRewards(claimedRewards);
    }

    function rewardsClaimable(address rewardsAddress)
        external
        view
        returns (uint256 rewardsToClaim)
    {
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter("HEGIC"));
        uint256[] memory optionIDs = getOptionIDs(msg.sender);
        rewardsToClaim = adapter.delegateRewardsClaimable(
            rewardsAddress,
            optionIDs
        );
    }

    function getOptionIDs(address user)
        private
        view
        returns (uint256[] memory optionIDs)
    {
        uint256 i = 0;
        uint256 j = 0;

        InstrumentPosition[] memory positions = instrumentPositions[user];

        optionIDs = new uint256[](positions.length.mul(2));

        while (i < positions.length) {
            if (
                keccak256(bytes(getAdapterName(positions[i].callVenue))) ==
                hegicHash
            ) {
                optionIDs[j] = positions[i].callOptionID;
                j += 1;
            }
            if (
                keccak256(bytes(getAdapterName(positions[i].putVenue))) ==
                hegicHash
            ) {
                optionIDs[j] = positions[i].putOptionID;
                j += 1;
            }
            i += 1;
        }
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
