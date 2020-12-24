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
    InstrumentInterface,
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
        string memory name,
        string memory symbol,
        address _underlying,
        address _strikeAsset,
        uint256 _expiry,
        uint256 _callStrikePrice,
        uint256 _putStrikePrice
    ) public initializer {
        require(block.timestamp < _expiry, "Expiry has already passed");

        factory = IDojiFactory(_factory);
        owner = _owner;
        _name = name;
        _symbol = symbol;
        expiry = _expiry;
        callStrikePrice = _callStrikePrice;
        putStrikePrice = _putStrikePrice;
        underlying = _underlying;
        strikeAsset = _strikeAsset;
    }

    function getBestTrade(uint256 optionAmount)
        public
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
    ) public payable nonReentrant {
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
            venues,
            optionTypes,
            amounts,
            optionIDs
        );
        uint256 positionID = instrumentPositions[msg.sender].length;
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

    // function buyInstrument(uint256 _amount) public payable nonReentrant {
    //     require(block.timestamp < expiry, "Cannot buy instrument after expiry");

    //     (
    //         InstrumentPosition memory position,
    //         uint256 costOfCall,
    //         uint256 costOfPut
    //     ) = createHegicOptions(_amount);

    //     uint256 positionID = instrumentPositions[msg.sender].length;
    //     instrumentPositions[msg.sender].push(position);

    //     emit PositionCreated(
    //         msg.sender,
    //         positionID,
    //         costOfCall,
    //         costOfPut,
    //         position.callProtocol,
    //         position.putProtocol,
    //         _amount,
    //         _amount,
    //         position.callOptionID,
    //         position.putOptionID
    //     );
    // }

    function exercise(uint256 positionID)
        public
        nonReentrant
        returns (uint256 profit)
    {
        // InstrumentPosition[] storage positions = instrumentPositions[msg
        //     .sender];
        // InstrumentPosition storage position = positions[positionID];
        // require(!position.exercised, "Already exercised");
        // require(block.timestamp <= expiry, "Already expired");
        // profit = exerciseHegicOptions(msg.sender, positionID);
        // position.exercised = true;
        // (bool success, ) = msg.sender.call{value: profit}("");
        // require(success, "Transferring profit failed");
        // emit Exercised(msg.sender, positionID, profit);
    }

    /**
     * @notice Deposits collateral into the system. Calls the `depositInteral` function
     * @param _amount is amount of collateral to deposit
     */
    function deposit(uint256 _amount) public override payable nonReentrant {
        raiseNotImplemented();
        require(_amount == 0);
    }

    /**
     * @notice Mints dTokens. Calls the `mintInternal` function
     * @param _amount is amount of dToken to mint
     */
    function mint(uint256 _amount) public override nonReentrant {
        raiseNotImplemented();
        require(_amount == 0);
    }

    /**
     * @notice Deposits collateral and mints dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     */
    function depositAndMint(uint256 _collateral, uint256 _dToken)
        external
        override
        payable
        nonReentrant
    {
        raiseNotImplemented();
        require(_collateral == 0 && _dToken == 0);
    }

    /**
     * @notice Deposits collateral, mints dToken, sells dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     * @param _maxSlippage is max % amount of slippage in WAD
     */
    function depositMintAndSell(
        uint256 _collateral,
        uint256 _dToken,
        uint256 _maxSlippage
    ) external override payable nonReentrant {
        raiseNotImplemented();
        require(_collateral == 0 && _dToken == 0 && _maxSlippage == 0);
    }

    /**
     * @notice Repays dToken debt in a vault
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebt(address _account, uint256 _amount)
        public
        override
        nonReentrant
    {
        raiseNotImplemented();
        require(_account == address(0) && _amount == 0);
    }

    /**
     * @notice Changes `expired` to True if timestamp is greater than expiry
     * It calculates the `settlePrice` with the current prices of target and
     * collateral assets, then sets them in stone.
     */
    function settle() public override {
        raiseNotImplemented();
    }

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint256 _dTokenAmount) external override nonReentrant {
        raiseNotImplemented();
        require(_dTokenAmount == 0);
    }

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawAfterExpiry() external override nonReentrant {
        raiseNotImplemented();
    }

    /**
     * @notice Raises to prevent calling
     */
    function raiseNotImplemented() private pure {
        require(false, "Not implemented");
    }
}
