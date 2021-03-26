// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {DSMath} from "../lib/DSMath.sol";
import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

import {
    State,
    IHegicOptions,
    HegicOptionType,
    IHegicETHOptions,
    IHegicBTCOptions,
    IHegicRewards
} from "../interfaces/HegicInterface.sol";
import {
    ProtocolAdapterTypes,
    IProtocolAdapter
} from "../adapters/IProtocolAdapter.sol";
import {IAmmAdapter} from "../adapters/IAmmAdapter.sol";
import {AmmAdapter} from "../adapters/AmmAdapter.sol";

import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IUniswapV2Pair} from "../interfaces/IUniswapV2Pair.sol";
import {OtokenInterface} from "../interfaces/GammaInterface.sol";
import {UniswapAdapter} from "../adapters/UniswapAdapter.sol";

import {StakedPutStorageV1} from "../storage/StakedPutStorage.sol";

contract StakedPut is DSMath, StakedPutStorageV1 {

    event PositionCreated(
        address indexed account,
        uint256 indexed positionID,
        string venue,
        uint256 amount
    );
    event Exercised(
        address indexed account,
        uint256 indexed positionID,
        uint256 totalProfit,
        bool[] optionsExercised
    );

    struct BuyInstrumentParams {
        uint8 putVenue;
        address paymentToken;
        uint256 putStrikePrice;
        uint256 amount;
        uint256 putMaxCost;
        bytes putBuyData;
    }

    using AmmAdapter for IAmmAdapter;
    using ProtocolAdapter for IProtocolAdapter;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IRibbonFactory public immutable factory;
    IProtocolAdapter public immutable adapter;
    IAmmAdapter public immutable iUniswapAdapter;
    IUniswapV2Pair public immutable ethWbtcPair;
    IHegicOptions public immutable options;
    address payable public uniswapAdapterAddress;
    string private constant adapterName = "HEGIC";
    string private constant instrumentName = "wbtc/digg-staked-put";
    address private constant _WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    uint256 public constant slippageBuffer = 1000;
    uint256 private constant month = 172800;
    bytes32 private constant uniswapHash = keccak256(abi.encodePacked("UNISWAP"));
    string public constant venue = 'HEGIC';
    ProtocolAdapterTypes.OptionType public constant optionType = ProtocolAdapterTypes.OptionType.Put;
    address public immutable ethAddress;
    address public immutable wbtcAddress;
    address public underlying;
    address public strikeAsset;
    address public collateralAsset;
    address public optionsAddress;


    constructor(address _factory, address payable _uniswapAdapterAddress, address ethWbtcPairAddr, address _ethAddress, address _wbtcAddress, address _wbtcOptionsAddress) {
        require(_factory != address(0), "!_factory");
        IRibbonFactory factoryInstance = IRibbonFactory(_factory);

        ethAddress = _ethAddress;
        wbtcAddress = _wbtcAddress;
        iUniswapAdapter = IAmmAdapter(_uniswapAdapterAddress);
        uniswapAdapterAddress = _uniswapAdapterAddress;
        ethWbtcPair = IUniswapV2Pair(ethWbtcPairAddr);
        address adapterAddress = factoryInstance.getAdapter(adapterName);
        require(adapterAddress != address(0), "Adapter not set");
        options = IHegicOptions(_wbtcOptionsAddress);
        factory = factoryInstance;
        adapter = IProtocolAdapter(adapterAddress);
        optionsAddress = _wbtcOptionsAddress;
    }

    /**
     * @notice Initializes the OptionVault contract with an owner and a factory.
     * @param _owner is the owner of the contract who can set the manager
     * @param _initCap is the initial vault's cap on deposits, the manager can increase this as necessary
     */
    function initialize(address _owner, uint256 _initCap, address _underlying, address _strikeAsset, address _collateralAsset) external initializer {
        require(_owner != address(0), "!_owner");
        require(_initCap > 0, "_initCap > 0");
        underlying = _underlying;
        strikeAsset = _strikeAsset;
        collateralAsset = _collateralAsset;

    }

function getName() public view returns(string memory)
    {
        return instrumentName;
    }

function getCurrentPrice() public view returns(uint256)
    {

        AggregatorV3Interface priceProvider =
            AggregatorV3Interface(options.priceProvider());
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        uint256 currentPrice = uint256(latestPrice);
        return currentPrice.mul(10000000000);
    }

function getInputs(address inputToken, uint256 amt, string memory exchangeName) public view returns(uint256 wbtcSize, uint256 expDigg, uint256 tradeAmt, uint256 premium, uint256 tota
lCost,
 uint256 currentPrice, uint256 expiry)
    {
        if (inputToken == ethAddress){
                wbtcSize = iUniswapAdapter.expectedWbtcOut(amt, exchangeName);
        }
        else if (inputToken == wbtcAddress) {
                wbtcSize = amt;
        }
        else{
                require(false, 'invalid input token');
        }

        (expDigg, tradeAmt) = iUniswapAdapter.expectedDiggOut(wbtcSize, exchangeName);

        //set expiry to a month from now
        //set strike to atm
        expiry = block.timestamp + month;
        currentPrice = uint256(getCurrentPrice());
        ProtocolAdapterTypes.OptionTerms memory optionTerms =  ProtocolAdapterTypes.OptionTerms(
                    underlying,
                    strikeAsset,
                    collateralAsset,
                    expiry,
                    currentPrice,
                    optionType,
                    inputToken
                );

        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter(venue));

        premium = adapter.premium(optionTerms, wbtcSize);

        totalCost = amt + premium;
    }

function buyInstrument(BuyInstrumentParams calldata params, uint256 expiry, address tokenInput, uint256 amt, string memory exchangeName, uint256 tradeAmt, uint256 minWbtcAmtOut, uint
256 minDiggAmtOut) public payable
    {
        buyLpFromAdapter(tokenInput, amt, exchangeName, tradeAmt, minWbtcAmtOut, minDiggAmtOut);
        uint256 positionID = buyPutFromAdapter(params, expiry);

        emit PositionCreated(
                msg.sender,
                positionID,
                exchangeName,
                amt
        );
    }

function buyLpFromAdapter(address tokenInput, uint256 amt, string memory exchangeName, uint256 tradeAmt, uint256 minWbtcAmtOut, uint256 minDiggAmtOut) public payable
    {
        iUniswapAdapter.delegateBuyLp(tokenInput, amt, exchangeName, tradeAmt, minWbtcAmtOut, minDiggAmtOut);
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
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter(adapterName));

        uint256 strikePrice;
        uint32 optionID;

        strikePrice = position.putStrikePrice;
        optionID = position.putOptionID;

        address paymentToken = address(0); // it is irrelevant at this stage

        address optionsAddress =
            adapter.getOptionsAddress(
                ProtocolAdapterTypes.OptionTerms(
                    underlying,
                    strikeAsset,
                    collateralAsset,
                    position.expiry,
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
            optionsExercised[0] = true;
        } else {
            optionsExercised[0] = false;
        }
        totalProfit += profit;

        position.exercised = true;

        emit Exercised(msg.sender, positionID, totalProfit, optionsExercised);
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

        uint256 amount = position.amount;

        uint256 strikePrice;
        uint32 optionID;

        strikePrice = position.putStrikePrice;
        optionID = position.putOptionID;

        address adapterAddress = factory.getAdapter(venue);
        require(adapterAddress != address(0), "Adapter does not exist");
        IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);
        address options =
            adapter.getOptionsAddress(
                ProtocolAdapterTypes.OptionTerms(
                    underlying,
                    strikeAsset,
                    collateralAsset,
                    position.expiry,
                    strikePrice,
                    optionType,
                    address(0) // paymentToken is not used at all nor stored in storage
                )
            );

        bool exercisable = adapter.canExercise(options, optionID, amount);
        if (!exercisable) {
            return 0;
        }

        profit += adapter.delegateExerciseProfit(options, optionID, amount);
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

        uint256 strikePrice;
        uint32 optionID;

        strikePrice = position.putStrikePrice;
        optionID = position.putOptionID;

        address adapterAddress = factory.getAdapter(venue);
        require(adapterAddress != address(0), "Adapter does not exist");
        IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);

        address options =
            adapter.getOptionsAddress(
                ProtocolAdapterTypes.OptionTerms(
                    underlying,
                    strikeAsset,
                    address(0), // collateralAsset not needed
                    position.expiry,
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
        return eitherOneCanExercise;
    }

//make this private for production
function buyPutFromAdapter(BuyInstrumentParams calldata params, uint256 expiry)
       public
        payable
        nonReentrant
        returns (uint256 positionID)
    {
        require(block.timestamp < expiry, "Cannot purchase after expiry");

        uint32 putOptionID =
            purchaseOptionAtVenue(
                venue,
                ProtocolAdapterTypes.OptionType.Put,
                params.amount,
                params.putStrikePrice,
                params.putBuyData,
                params.paymentToken,
                params.putMaxCost,
                expiry
            );

        InstrumentPosition memory position =
            InstrumentPosition(
                false,
                params.putVenue,
                putOptionID,
                params.amount,
                params.putStrikePrice,
                expiry
            );

        positionID = instrumentPositions[msg.sender].length;
        instrumentPositions[msg.sender].push(position);

        uint256 balance = address(this).balance;
        if (balance > 0) payable(msg.sender).transfer(balance);
    }

    function purchaseOptionAtVenue(
        string memory venue,
        ProtocolAdapterTypes.OptionType optionType,
        uint256 amount,
        uint256 strikePrice,
        bytes memory buyData,
        address paymentToken,
        uint256 maxCost,
        uint256 expiry
    ) private returns (uint32 optionID) {
        address adapterAddress = factory.getAdapter(venue);
        require(adapterAddress != address(0), "Adapter does not exist");
        IProtocolAdapter adapter = IProtocolAdapter(adapterAddress);

        require(
            optionType != ProtocolAdapterTypes.OptionType.Invalid,
            "Invalid option type"
        );

        uint256 _expiry = expiry;

            optionID = purchaseWithContract(
                adapter,
                optionType,
                amount,
                strikePrice,
                paymentToken,
                maxCost,
                _expiry
            );

    }


    function purchaseWithContract(
        IProtocolAdapter adapter,
        ProtocolAdapterTypes.OptionType optionType,
        uint256 amount,
        uint256 strikePrice,
        address paymentToken,
        uint256 maxCost,
        uint256 _expiry
    ) private returns (uint32 optionID) {
        ProtocolAdapterTypes.OptionTerms memory optionTerms =
            ProtocolAdapterTypes.OptionTerms(
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


}
