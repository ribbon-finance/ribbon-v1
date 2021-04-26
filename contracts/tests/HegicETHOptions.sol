pragma solidity >=0.7.2;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Hegic
 * Copyright (C) 2020 Hegic Protocol
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import "./HegicETHPool.sol";


/**
 * @author 0mllwntrmt3
 * @title Hegic ETH (Ether) Bidirectional (Call and Put) Options
 * @notice Hegic ETH Options Contract
 */
contract HegicETHOptions is Ownable, IHegicOptions {
    using SafeMath for uint256;

    IHegicStakingETH public settlementFeeRecipient;
    Option[] public override options;
    uint256 public impliedVolRate;
    uint256 public optionCollateralizationRatio = 100;
    uint256 internal constant PRICE_DECIMALS = 1e8;
    uint256 internal contractCreationTimestamp;
    bool internal migrationProcess = true;
    HegicETHOptions private oldHegicETHOptions;
    AggregatorV3Interface public priceProvider;
    HegicETHPool public pool;

    /**
     * @param pp The address of ChainLink ETH/USD price feed contract
     */
    constructor(AggregatorV3Interface pp, IHegicStakingETH staking, HegicETHPool _pool) public {
        pool = _pool;
        priceProvider = pp;
        settlementFeeRecipient = staking;
        impliedVolRate = 4500;
        contractCreationTimestamp = block.timestamp;
    }

    /**
     * @notice Can be used to update the contract in critical situations
     *         in the first 14 days after deployment
     */
    function transferPoolOwnership() external onlyOwner {
        require(block.timestamp < contractCreationTimestamp + 14 days);
        pool.transferOwnership(owner());
    }

    /**
     * @notice Used for adjusting the options prices while balancing asset's implied volatility rate
     * @param value New IVRate value
     */
    function setImpliedVolRate(uint256 value) external onlyOwner {
        require(value >= 1000, "ImpliedVolRate limit is too small");
        impliedVolRate = value;
    }

    /**
     * @notice Used for changing settlementFeeRecipient
     * @param recipient New settlementFee recipient address
     */
    function setSettlementFeeRecipient(IHegicStakingETH recipient) external onlyOwner {
        require(block.timestamp < contractCreationTimestamp + 14 days);
        require(address(recipient) != address(0));
        settlementFeeRecipient = recipient;
    }

    /**
     * @notice Used for changing option collateralization ratio
     * @param value New optionCollateralizationRatio value
     */
    function setOptionCollaterizationRatio(uint value) external onlyOwner {
        require(50 <= value && value <= 100, "wrong value");
        optionCollateralizationRatio = value;
    }

    /**
     * @notice Creates a new option
     * @param period Option period in seconds (1 days <= period <= 4 weeks)
     * @param amount Option amount
     * @param strike Strike price of the option
     * @param optionType Call or Put option type
     * @return optionID Created option's ID
     */
    function create(
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    )
        external
        payable
        returns (uint256 optionID)
    {
        (uint256 total, uint256 settlementFee, uint256 strikeFee, ) = fees(
            period,
            amount,
            strike,
            optionType
        );

        require(
            optionType == OptionType.Call || optionType == OptionType.Put,
            "Wrong option type"
        );
        require(period >= 1 days, "Period is too short");
        require(period <= 4 weeks, "Period is too long");
        require(amount > strikeFee, "Price difference is too large");
        require(msg.value >= total, "Wrong value");
        if (msg.value > total) msg.sender.transfer(msg.value - total);

        uint256 strikeAmount = amount.sub(strikeFee);
        optionID = options.length;
        Option memory option = Option(
            State.Active,
            msg.sender,
            strike,
            amount,
            strikeAmount.mul(optionCollateralizationRatio).div(100).add(strikeFee),
            total.sub(settlementFee),
            block.timestamp + period,
            optionType
        );

        options.push(option);
        settlementFeeRecipient.sendProfit {value: settlementFee}();
        pool.lock {value: option.premium} (optionID, option.lockedAmount);
        emit Create(optionID, msg.sender, settlementFee, total);
    }

    /**
     * @notice Transfers an active option
     * @param optionID ID of your option
     * @param newHolder Address of new option holder
     */
    function transfer(uint256 optionID, address payable newHolder) external {
        Option storage option = options[optionID];

        require(newHolder != address(0), "new holder address is zero");
        require(option.expiration >= block.timestamp, "Option has expired");
        require(option.holder == msg.sender, "Wrong msg.sender");
        require(option.state == State.Active, "Only active options could be transferred");

        option.holder = newHolder;
    }

    /**
     * @notice Exercises an active option
     * @param optionID ID of your option
     */
    function exercise(uint256 optionID) external {
        Option storage option = options[optionID];

        require(option.expiration >= block.timestamp, "Option has expired");
        require(option.holder == msg.sender, "Wrong msg.sender");
        require(option.state == State.Active, "Wrong state");

        option.state = State.Exercised;
        uint256 profit = payProfit(optionID);

        emit Exercise(optionID, profit);
    }

    /**
     * @notice Unlocks an array of options
     * @param optionIDs array of options
     */
    function unlockAll(uint256[] calldata optionIDs) external {
        uint arrayLength = optionIDs.length;
        for (uint256 i = 0; i < arrayLength; i++) {
            unlock(optionIDs[i]);
        }
    }

    function migrate(uint count) external onlyOwner {
        require(migrationProcess, "Migration Process was ended");
        require(
            pool.owner() != address(this),
            "Liquidity Pool already attached"
        );
        require(address(oldHegicETHOptions) != address(0));
        for (uint i = 0; i < count; i++){
            uint optionID = options.length;
            HegicETHOptions.Option memory option;
            (
                option.state,
                option.holder,
                option.strike,
                option.amount,
                option.lockedAmount,
                option.premium,
                option.expiration,
                option.optionType
            ) = oldHegicETHOptions.options(optionID);
            uint settlementFee = getSettlementFee(option.amount);
            options.push(option);
            emit Create(
                optionID,
                option.holder,
                settlementFee,
                option.premium.add(settlementFee)
            );
        }
    }

    function setOldHegicETHOptions(address oldAddr) external onlyOwner {
        require(address(oldHegicETHOptions) == address(0));
        oldHegicETHOptions = HegicETHOptions(oldAddr);
    }

    function stopMigrationProcess() external onlyOwner {
        migrationProcess = false;
    }

    /**
     * @notice Used for getting the actual options prices
     * @param period Option period in seconds (1 days <= period <= 4 weeks)
     * @param amount Option amount
     * @param strike Strike price of the option
     * @return total Total price to be paid
     * @return settlementFee Amount to be distributed to the HEGIC token holders
     * @return strikeFee Amount that covers the price difference in the ITM options
     * @return periodFee Option period fee amount
     */
    function fees(
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    )
        public
        view
        returns (
            uint256 total,
            uint256 settlementFee,
            uint256 strikeFee,
            uint256 periodFee
        )
    {
        (,int latestPrice,,,) = priceProvider.latestRoundData();
        uint256 currentPrice = uint256(latestPrice);
        settlementFee = getSettlementFee(amount);
        periodFee = getPeriodFee(amount, period, strike, currentPrice, optionType);
        strikeFee = getStrikeFee(amount, strike, currentPrice, optionType);
        total = periodFee.add(strikeFee).add(settlementFee);
    }

    /**
     * @notice Unlock funds locked in the expired options
     * @param optionID ID of the option
     */
    function unlock(uint256 optionID) public {
        Option storage option = options[optionID];
        require(option.expiration < block.timestamp, "Option has not expired yet");
        require(option.state == State.Active, "Option is not active");
        option.state = State.Expired;
        pool.unlock(optionID);
        emit Expire(optionID, option.premium);
    }

    /**
     * @notice Calculates settlementFee
     * @param amount Option amount
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
     * @param amount Option amount
     * @param period Option period in seconds (1 days <= period <= 4 weeks)
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
        OptionType optionType
    ) internal view returns (uint256 fee) {
        if (optionType == OptionType.Put)
            return amount
                .mul(sqrt(period))
                .mul(impliedVolRate)
                .mul(strike)
                .div(currentPrice)
                .div(PRICE_DECIMALS);
        else
            return amount
                .mul(sqrt(period))
                .mul(impliedVolRate)
                .mul(currentPrice)
                .div(strike)
                .div(PRICE_DECIMALS);
    }

    /**
     * @notice Calculates strikeFee
     * @param amount Option amount
     * @param strike Strike price of the option
     * @param currentPrice Current price of ETH
     * @return fee Strike fee amount
     */
    function getStrikeFee(
        uint256 amount,
        uint256 strike,
        uint256 currentPrice,
        OptionType optionType
    ) internal pure returns (uint256 fee) {
        if (strike > currentPrice && optionType == OptionType.Put)
            return strike.sub(currentPrice).mul(amount).div(currentPrice);
        if (strike < currentPrice && optionType == OptionType.Call)
            return currentPrice.sub(strike).mul(amount).div(currentPrice);
        return 0;
    }

    /**
     * @notice Sends profits in ETH from the ETH pool to an option holder's address
     * @param optionID A specific option contract id
     */
    function payProfit(uint optionID)
        internal
        returns (uint profit)
    {
        Option memory option = options[optionID];
        (, int latestPrice, , , ) = priceProvider.latestRoundData();
        uint256 currentPrice = uint256(latestPrice);
        if (option.optionType == OptionType.Call) {
            require(option.strike <= currentPrice, "Current price is too low");
            profit = currentPrice.sub(option.strike).mul(option.amount).div(currentPrice);
        } else {
            require(option.strike >= currentPrice, "Current price is too high");
            profit = option.strike.sub(currentPrice).mul(option.amount).div(currentPrice);
        }
        if (profit > option.lockedAmount)
            profit = option.lockedAmount;
        pool.send(optionID, option.holder, profit);
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