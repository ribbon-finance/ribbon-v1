// SPDX-License-Identifier: MIT
// Credit to Molly Wintermute, Hegic Protocol
pragma solidity >=0.6.0;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/HegicInterface.sol";

contract MockHegicETHOptions is IHegicETHOptions {
    using SafeMath for uint256;

    uint256 private _currentPrice;
    uint256 public constant impliedVolRate = 4500;
    uint256 public constant optionCollateralizationRatio = 100;
    HegicOption[] public override options;
    uint256 internal constant PRICE_DECIMALS = 1e8;
    address public pool;
    address public settlementFeeRecipient;
    address private _priceProvider;

    constructor(address _pool, address _settlementFeeRecipient) public {
        pool = _pool;
        settlementFeeRecipient = _settlementFeeRecipient;
        _priceProvider = address(new MockAggregator());
    }

    function fees(
        uint256 period,
        uint256 amount,
        uint256 strike,
        HegicOptionType optionType
    )
        public
        override
        view
        returns (
            uint256 total,
            uint256 settlementFee,
            uint256 strikeFee,
            uint256 periodFee
        )
    {
        uint256 currentPrice = getCurrentPrice();
        settlementFee = getSettlementFee(amount);
        periodFee = getPeriodFee(
            amount,
            period,
            strike,
            currentPrice,
            optionType
        );
        strikeFee = getStrikeFee(amount, strike, currentPrice, optionType);
        total = periodFee.add(strikeFee).add(settlementFee);
    }

    function create(
        uint256 period,
        uint256 amount,
        uint256 strike,
        HegicOptionType optionType
    ) external override payable returns (uint256 optionID) {
        (uint256 total, uint256 settlementFee, uint256 strikeFee, ) = fees(
            period,
            amount,
            strike,
            optionType
        );

        require(
            optionType == HegicOptionType.Call ||
                optionType == HegicOptionType.Put,
            "Wrong option type"
        );
        require(period >= 1 days, "Period is too short");
        require(period <= 4 weeks, "Period is too long");
        require(amount > strikeFee, "Price difference is too large");
        require(msg.value >= total, "Wrong value");
        if (msg.value > total) msg.sender.transfer(msg.value - total);

        uint256 strikeAmount = amount.sub(strikeFee);
        optionID = options.length;
        HegicOption memory option = HegicOption(
            State.Active,
            msg.sender,
            strike,
            amount,
            strikeAmount.mul(optionCollateralizationRatio).div(100).add(
                strikeFee
            ),
            total.sub(settlementFee),
            block.timestamp + period,
            optionType
        );

        options.push(option);
        (bool transferSuccess1, ) = settlementFeeRecipient.call{
            value: settlementFee
        }("");
        (bool transferSuccess2, ) = pool.call{value: option.premium}("");
        require(transferSuccess1);
        require(transferSuccess2);
    }

    /**
     * @notice Exercises an active option
     * @param optionID ID of your option
     */
    function exercise(uint256 optionID) external override {
        HegicOption storage option = options[optionID];

        require(option.expiration >= block.timestamp, "Option has expired");
        require(option.holder == msg.sender, "Wrong msg.sender");
        require(option.state == State.Active, "Wrong state");

        option.state = State.Exercised;
        uint256 profit = payProfit(optionID);

        emit Exercise(optionID, profit);
    }

    /**
     * @notice Sends profits in ETH from the ETH pool to an option holder's address
     * @param optionID A specific option contract id
     */
    function payProfit(uint256 optionID) internal returns (uint256 profit) {
        HegicOption memory option = options[optionID];
        uint256 currentPrice = getCurrentPrice();
        if (option.optionType == HegicOptionType.Call) {
            require(option.strike <= currentPrice, "Current price is too low");
            profit = currentPrice.sub(option.strike).mul(option.amount).div(
                currentPrice
            );
        } else {
            require(option.strike >= currentPrice, "Current price is too high");
            profit = option.strike.sub(currentPrice).mul(option.amount).div(
                currentPrice
            );
        }
        if (profit > option.lockedAmount) profit = option.lockedAmount;
        (bool success, ) = option.holder.call{value: profit}("");
        require(success);
    }

    /**
     * @notice Calculates settlementFee
     * @param amount HegicOption amount
     * @return fee Settlement fee amount
     */
    function getSettlementFee(uint256 amount)
        internal
        pure
        returns (uint256 fee)
    {
        return amount / 100;
    }

    /**
     * @notice Calculates periodFee
     * @param amount HegicOption amount
     * @param period HegicOption period in seconds (1 days <= period <= 4 weeks)
     * @param strike Strike price of the option
     * @param currentPrice Current price of ETH
     * @return fee Period fee amount
     *
     * amount < 1e30        |
     * impliedVolRate < 1e10| => amount * impliedVolRate * strike < 1e60 < 2^uint256
     * strike < 1e20 ($1T)  |
     *
     * in case amount * impliedVolRate * strike >= 2^256
     * transaction will be reverted by the SafeMath
     */
    function getPeriodFee(
        uint256 amount,
        uint256 period,
        uint256 strike,
        uint256 currentPrice,
        HegicOptionType optionType
    ) internal pure returns (uint256 fee) {
        if (optionType == HegicOptionType.Put)
            return
                amount
                    .mul(sqrt(period))
                    .mul(impliedVolRate)
                    .mul(strike)
                    .div(currentPrice)
                    .div(PRICE_DECIMALS);
        else
            return
                amount
                    .mul(sqrt(period))
                    .mul(impliedVolRate)
                    .mul(currentPrice)
                    .div(strike)
                    .div(PRICE_DECIMALS);
    }

    /**
     * @notice Calculates strikeFee
     * @param amount HegicOption amount
     * @param strike Strike price of the option
     * @param currentPrice Current price of ETH
     * @return fee Strike fee amount
     */
    function getStrikeFee(
        uint256 amount,
        uint256 strike,
        uint256 currentPrice,
        HegicOptionType optionType
    ) internal pure returns (uint256 fee) {
        if (strike > currentPrice && optionType == HegicOptionType.Put)
            return strike.sub(currentPrice).mul(amount).div(currentPrice);
        if (strike < currentPrice && optionType == HegicOptionType.Call)
            return currentPrice.sub(strike).mul(amount).div(currentPrice);
        return 0;
    }

    function getCurrentPrice() public view returns (uint256) {
        return _currentPrice;
    }

    function setCurrentPrice(uint256 currentPrice) public {
        _currentPrice = currentPrice;
        MockAggregator pp = MockAggregator(_priceProvider);
        pp.setPrice(currentPrice);
    }

    function priceProvider() external override returns (address) {
        return _priceProvider;
    }

    /**
     * @return result Square root of the number
     */
    function sqrt(uint256 x) private pure returns (uint256 result) {
        result = x;
        uint256 k = x.div(2).add(1);
        while (k < result) (result, k) = (k, x.div(k).add(k).div(2));
    }
}

contract MockAggregator {
    int256 private latestPrice;

    function setPrice(uint256 _latestPrice) public {
        latestPrice = int256(_latestPrice);
    }

    function latestRoundData()
        external
        returns (
            uint80 roundID,
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        )
    {
        roundID = 0;
        price = latestPrice;
        startedAt = 0;
        timeStamp = 0;
        answeredInRound = 0;
    }
}
