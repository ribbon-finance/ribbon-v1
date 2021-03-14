// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IProtocolAdapter, ProtocolAdapterTypes} from "./IProtocolAdapter.sol";
import {
    IOptionFactory,
    IOptionMarket,
    IOptionToken,
    IOptionViews
} from "../interfaces/CharmInterface.sol";
import {
    InstrumentStorageV1,
    InstrumentStorageV2,
    InstrumentStorageV3
} from "../storage/InstrumentStorage.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {UniERC20} from "../lib/UniERC20.sol";

contract CharmAdapter is IProtocolAdapter, InstrumentStorageV1, InstrumentStorageV2, InstrumentStorageV3{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using UniERC20 for IERC20;

    IOptionFactory public immutable optionFactory;
    IOptionViews public immutable optionViews;

    string private constant _name = "CHARM";
    bool private constant _nonFungible = false;

    constructor(
        address _optionFactory,
        address _optionViews
    ) {
        require(_optionFactory != address(0), "!_optionFactory");
        require(_optionViews != address(0), "!_optionViews");
        optionFactory = IOptionFactory(_optionFactory);
        optionViews = IOptionViews(_optionViews);
    }

    receive() external payable {}

    function protocolName() external pure override returns (string memory) {
        return _name;
    }

    function nonFungible() external pure override returns (bool) {
        return _nonFungible;
    }

    function purchaseMethod()
        external
        pure
        override
        returns (ProtocolAdapterTypes.PurchaseMethod)
    {
        return ProtocolAdapterTypes.PurchaseMethod.Contract;
    }

    /**
     * @notice Check if an options contract exist based on the passed parameters.
     * @param optionTerms is the terms of the option contract
     */
    function optionsExist(ProtocolAdapterTypes.OptionTerms calldata optionTerms)
        external
        view
        override
        returns (bool)
    {
        return lookupOToken(optionTerms) != address(0);
    }

    /**
     * @notice Get the options contract's address based on the passed parameters
     * @param optionTerms is the terms of the option contract
     */
    function getOptionsAddress(
        ProtocolAdapterTypes.OptionTerms calldata optionTerms
    ) external view override returns (address) {
        return lookupOToken(optionTerms);
    }

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     */
    function premium(
      ProtocolAdapterTypes.OptionTerms calldata optionTerms,
      uint256 purchaseAmount
    )
        external
        view
        override
        returns (uint256 cost)
    {
        address tokenAddress = lookupOToken(optionTerms);

        require(tokenAddress != address(0), "Must be valid option terms!");

        // Get strike index, whether is long
        OptionType memory optionType = addressToOptionType[tokenAddress];

        //get token
        IOptionToken token = IOptionToken(tokenAddress);
        //get market
        IOptionMarket market = IOptionMarket(token.market());

        cost = optionViews.getBuyOptionCost(market, optionType.isLongToken, optionType.strikeIndex, purchaseAmount);
    }

    /**
     * @notice Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.
     * @param options is the address of the options contract
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     */
    function exerciseProfit(
        address options,
        uint256,
        uint256 amount
    ) public view override returns (uint256 profit) {
      //get token
      IOptionToken token = IOptionToken(options);
      //get market
      IOptionMarket market = IOptionMarket(token.market());

      // Get strike index, whether is long
      OptionType memory optionType = addressToOptionType[options];

      //profit of exercising
      profit = optionViews.getSellOptionCost(market, optionType.isLongToken, optionType.strikeIndex, amount);
    }

    function canExercise(
        address options,
        uint256,
        uint256 amount
    ) public view override returns (bool) {
        //get token
        IOptionToken token = IOptionToken(options);
        //get market
        IOptionMarket market = IOptionMarket(token.market());

        if (block.timestamp < market.expiryTime()) {
            return false;
        }
        if (exerciseProfit(options, 0, amount) > 0) {
            return true;
        }
        return false;
    }

    /**
     * @notice Purchases the options contract.
     * @param optionTerms is the terms of the option contract
     * @param amount is the purchase amount in Wad units (10**18)
     * @param maxCost is the max amount of paymentToken to be paid for the option (to avoid sandwich attacks, ...)
     */
    function purchase(
        ProtocolAdapterTypes.OptionTerms calldata optionTerms,
        uint256 amount,
        uint256 maxCost
    ) external payable override returns (uint256) {
      require(
          block.timestamp < optionTerms.expiry,
          "Cannot purchase after expiry"
      );

      //get token address
      address tokenAddress = lookupOToken(optionTerms);
      if(tokenAddress == address(0)){
        this.populateOTokenMappings();
      }

      tokenAddress = lookupOToken(optionTerms);

      require(tokenAddress != address(0), "Market needs to exist!");

      // Get strike index, whether is long
      OptionType memory optionType = addressToOptionType[tokenAddress];
      //get token
      IOptionToken token = IOptionToken(tokenAddress);
      //get market
      IOptionMarket market = IOptionMarket(token.market());
      IERC20 baseToken = IERC20(optionTerms.underlying);

      uint256 amountIn;

      if(baseToken.isETH()){
        amountIn = market.buy{value: address(this).balance}(
          optionType.isLongToken,
          optionType.strikeIndex,
          amount,
          maxCost
        );
      }else{
        uint256 balanceBefore = baseToken.uniBalanceOf(address(this));
        baseToken.uniTransferFromSenderToThis(amount);
        uint256 balanceAfter = baseToken.uniBalanceOf(address(this));

        baseToken.safeApprove(address(market), balanceAfter.sub(balanceBefore));
        amountIn = market.buy(
          optionType.isLongToken,
          optionType.strikeIndex,
          amount,
          maxCost
        );
      }

      emit Purchased(
          msg.sender,
          _name,
          optionTerms.underlying,
          amountIn,
          0
      );
    }

    /**
     * @notice Exercises the options contract.
     * @param options is the address of the options contract
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     * @param recipient is the account that receives the exercised profits. This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address options,
        uint256,
        uint256 amount,
        address recipient
    ) public payable override {

      // Get strike index, whether is long
      OptionType memory optionType = addressToOptionType[options];

      //get token
      IOptionToken token = IOptionToken(options);
      //get market
      IOptionMarket market = IOptionMarket(token.market());

      uint256 profit = exerciseProfit(options, 0, amount);
      require(profit > 0, "Not profitable to exercise");

      // if we are exercising but market has not settled, do it
      if(market.isExpired() && !market.isSettled()){
        market.settle();
      }

      uint256 amountOut = market.sell(optionType.isLongToken, optionType.strikeIndex, amount, profit);

      //transfer over
      market.baseToken().uniTransfer(payable(recipient), amountOut);

      emit Exercised(
          msg.sender,
          options,
          0,
          amount,
          amountOut
      );
    }

    function createShort(ProtocolAdapterTypes.OptionTerms memory, uint256)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }

    function closeShort() external pure override returns (uint256) {
        return 0;
    }

    /**
     * @notice Function to lookup oToken addresses.
     * @param optionTerms is the terms of the option contract
     */
    function lookupOToken(ProtocolAdapterTypes.OptionTerms memory optionTerms)
        public
        view
        returns (address token)
    {
        bool isPut =
            optionTerms.optionType == ProtocolAdapterTypes.OptionType.Put;

        //market.baseToken() is underlying asset if call. Strike currency if put. Represents ETH if equal to 0x0
        address underlying = isPut == true ? optionTerms.strikeAsset : optionTerms.underlying;

        //there should only be a collateral asset for charm if we are writing an option
        bool isShort = optionTerms.collateralAsset == address(1) ? false : true;

        // refer to mapping after encoding with _getOptionId
        bytes32 id = _getOptionId(underlying, isShort, optionTerms.strikePrice, optionTerms.expiry, isPut);

        token = idToAddress[id];
    }

    // Populate mappings to option token addresses
    function populateOTokenMappings()
        external
    {
      uint256 i = optionFactory.numMarkets() - 1;

      while (i >= 0) {
        IOptionMarket market = IOptionMarket(optionFactory.markets(i));

        if(seenMarket[address(market)] || market.isSettled()){
          break;
        }

        bool isMarketPut = market.isPut();
        uint256 marketExpiry = market.expiryTime();
        IERC20 baseToken = market.baseToken();

        populateMarket(market, baseToken, isMarketPut, marketExpiry);
        seenMarket[address(market)] = true;

        i -= 1;
      }
    }

    function populateMarket(
      IOptionMarket market,
      IERC20 baseToken,
      bool isPut,
      uint256 expiry
    ) internal {
        for(uint j = 0; j < market.numStrikes(); j++) {
          // For long tokens
          bytes32 idLong = _getOptionId(address(baseToken), false, market.strikePrices(j), expiry, isPut);
          address longToken = address(market.longTokens(j));
          idToAddress[idLong] = longToken;
          OptionType memory lo = OptionType(true, j);
          addressToOptionType[longToken] = lo;

          // For short tokens
          bytes32 idShort = _getOptionId(address(baseToken), true, market.strikePrices(j), expiry, isPut);
          address shortToken = address(market.shortTokens(j));
          idToAddress[idShort] = shortToken;
          OptionType memory sh = OptionType(false, j);
          addressToOptionType[shortToken] = sh;
        }
    }

    /**
     * @dev hash oToken parameters and return a unique option id
     * @param _underlyingAsset asset that the option references
     * @param _isShort True if selling, False if buying
     * @param _strikePrice strike price with decimals = 18
     * @param _expiry expiration timestamp as a unix timestamp
     * @param _isPut True if a put option, False if a call option
     * @return id the unique id of an oToken
     */
    function _getOptionId(
        address _underlyingAsset,
        bool _isShort,
        uint256 _strikePrice,
        uint256 _expiry,
        bool _isPut
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(_underlyingAsset, _isShort, _strikePrice, _expiry, _isPut)
            );
    }
}
