// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {
    AggregatorV3Interface
} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    IProtocolAdapter,
    OptionTerms,
    OptionType,
    PurchaseMethod
} from "./IProtocolAdapter.sol";
import {
    State,
    IHegicOptions,
    HegicOptionType,
    IHegicETHOptions,
    IHegicBTCOptions,
    IHegicRewards
} from "../interfaces/HegicInterface.sol";

import {ISwapPair} from "../interfaces/ISwapPair.sol";

import {IWETH} from "../interfaces/IWETH.sol";

contract HegicAdapter is IProtocolAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    string private constant _name = "HEGIC";
    bool private constant _nonFungible = true;
    address public immutable ethAddress;
    address public constant wethAddress =
        address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public immutable wbtcAddress;
    IHegicETHOptions public immutable ethOptions;
    IHegicBTCOptions public immutable wbtcOptions;
    ISwapPair public immutable ethWbtcPair;

    /**
     * @notice constructor for the HegicAdapter
     * @param _ethOptions is the contract address for the mainnet HegicETHOptions
     * @param _wbtcOptions is the contract address for the mainnet HegicWBTCOptions
     * @param _ethAddress is the contract address for Ethereum, defaults to zero address
     * @param _wbtcOptions is the contract address for mainnet WBTC
     */
    constructor(
        address _ethOptions,
        address _wbtcOptions,
        address _ethAddress,
        address _wbtcAddress,
        address _ethWbtcPair
    ) {
        ethOptions = IHegicETHOptions(_ethOptions);
        wbtcOptions = IHegicBTCOptions(_wbtcOptions);
        ethAddress = _ethAddress;
        wbtcAddress = _wbtcAddress;
        // add check of correct Pair OR use token addresses to calc the pair address
        ethWbtcPair = ISwapPair(_ethWbtcPair);
    }

    receive() external payable {}

    function protocolName() public pure override returns (string memory) {
        return _name;
    }

    function nonFungible() external pure override returns (bool) {
        return _nonFungible;
    }

    function purchaseMethod() external pure override returns (PurchaseMethod) {
        return PurchaseMethod.Contract;
    }

    /**
     * @notice Check if an options contract exist based on the passed parameters.
     * @param optionTerms is the terms of the option contract
     */
    function optionsExist(OptionTerms calldata optionTerms)
        external
        view
        override
        returns (bool)
    {
        return
            optionTerms.underlying == ethAddress ||
            optionTerms.underlying == wbtcAddress;
    }

    /**
     * @notice Get the options contract's address based on the passed parameters
     * @param optionTerms is the terms of the option contract
     */
    function getOptionsAddress(OptionTerms calldata optionTerms)
        external
        view
        override
        returns (address)
    {
        if (optionTerms.underlying == ethAddress) {
            return address(ethOptions);
        } else if (optionTerms.underlying == wbtcAddress) {
            return address(wbtcOptions);
        }
        require(false, "No options found");
    }

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     * @param optionTerms is the terms of the option contract
     * @param purchaseAmount is the purchase amount in Wad units (10**18)
     */
    function premium(OptionTerms memory optionTerms, uint256 purchaseAmount)
        public
        view
        override
        returns (uint256 cost)
    {
        require(
            block.timestamp < optionTerms.expiry,
            "Cannot purchase after expiry"
        );

        uint256 period = optionTerms.expiry.sub(block.timestamp);
        uint256 scaledStrikePrice =
            scaleDownStrikePrice(optionTerms.strikePrice);

        if (optionTerms.underlying == ethAddress) {
            require(
                optionTerms.underlying == optionTerms.paymentToken,
                "!invalid paymentToken"
            );
            (cost, , , ) = ethOptions.fees(
                period,
                purchaseAmount,
                scaledStrikePrice,
                HegicOptionType(uint8(optionTerms.optionType))
            );
        } else if (optionTerms.underlying == wbtcAddress) {
            uint256 costWBTC;
            (costWBTC, cost, , , ) = wbtcOptions.fees(
                period,
                purchaseAmount,
                scaledStrikePrice,
                HegicOptionType(uint8(optionTerms.optionType))
            );
            if (optionTerms.paymentToken == wbtcAddress) {
                cost = costWBTC;
            }
        } else {
            require(false, "No matching underlying");
        }
    }

    /**
     * @notice Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.
     * @param optionsAddress is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     */
    function exerciseProfit(
        address optionsAddress,
        uint256 optionID,
        uint256
    ) public view override returns (uint256 profit) {
        require(
            optionsAddress == address(ethOptions) ||
                optionsAddress == address(wbtcOptions),
            "optionsAddress must match either ETH or WBTC options"
        );
        IHegicOptions options = IHegicOptions(optionsAddress);

        AggregatorV3Interface priceProvider =
            AggregatorV3Interface(options.priceProvider());
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        uint256 currentPrice = uint256(latestPrice);

        (
            ,
            ,
            uint256 strike,
            uint256 amount,
            uint256 lockedAmount,
            ,
            ,
            HegicOptionType optionType
        ) = options.options(optionID);

        if (optionType == HegicOptionType.Call) {
            if (currentPrice >= strike) {
                profit = currentPrice.sub(strike).mul(amount).div(currentPrice);
            } else {
                profit = 0;
            }
        } else {
            if (currentPrice <= strike) {
                profit = strike.sub(currentPrice).mul(amount).div(currentPrice);
            } else {
                profit = 0;
            }
        }
        if (profit > lockedAmount) profit = lockedAmount;
    }

    function canExercise(
        address options,
        uint256 optionID,
        uint256 amount
    ) public view override returns (bool) {
        bool matchOptionsAddress =
            options == address(ethOptions) || options == address(wbtcOptions);

        (State state, , , , , , uint256 expiration, ) =
            IHegicOptions(options).options(optionID);
        amount = 0;

        uint256 profit = exerciseProfit(options, optionID, amount);

        return
            matchOptionsAddress &&
            expiration >= block.timestamp &&
            state == State.Active &&
            profit > 0;
    }

    /**
     * @notice Purchases the options contract.
     * @param optionTerms is the terms of the option contract
     * @param amount is the purchase amount in Wad units (10**18)
     * @param maxCost is the max amount of paymentToken to be paid for the option (to avoid sandwich attacks, ...)
     */
    function purchase(
        OptionTerms calldata optionTerms,
        uint256 amount,
        uint256 maxCost
    ) external payable override returns (uint256 optionID) {
        require(
            block.timestamp < optionTerms.expiry,
            "Cannot purchase after expiry"
        );

        uint256 cost =
            premium(
                OptionTerms(
                    optionTerms.underlying,
                    optionTerms.strikeAsset,
                    optionTerms.collateralAsset,
                    optionTerms.expiry,
                    optionTerms.strikePrice,
                    optionTerms.optionType,
                    ethAddress // force total cost to be in ETH
                ),
                amount
            );

        uint256 scaledStrikePrice =
            scaleDownStrikePrice(optionTerms.strikePrice);
        uint256 period = optionTerms.expiry.sub(block.timestamp);
        IHegicOptions options = getHegicOptions(optionTerms.underlying);

        // swap for ETH if ETH has not been provided as paymentToken
        if (msg.value == 0) {
            require(
                optionTerms.paymentToken == wbtcAddress,
                "Invalid paymentToken or msg.value"
            );
            uint256 costWBTC = _getAmountsIn(cost);
            require(maxCost >= costWBTC, "MaxCost is too low");
            _swapWBTCToETH(costWBTC, cost);
        } else {
            require(msg.value >= cost, "Value does not cover cost");
        }

        optionID = options.create{value: cost}(
            period,
            amount,
            scaledStrikePrice,
            HegicOptionType(uint8(optionTerms.optionType))
        );

        emit Purchased(
            msg.sender,
            _name,
            optionTerms.underlying,
            optionTerms.strikeAsset,
            optionTerms.expiry,
            optionTerms.strikePrice,
            optionTerms.optionType,
            amount,
            cost,
            optionID
        );
    }

    /**
     * @notice Exercises the options contract.
     * @param optionsAddress is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     * @param account is the account that receives the exercised profits. This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address optionsAddress,
        uint256 optionID,
        uint256 amount,
        address account
    ) external payable override {
        require(
            optionsAddress == address(ethOptions) ||
                optionsAddress == address(wbtcOptions),
            "optionsAddress must match either ETH or WBTC options"
        );

        IHegicOptions options = IHegicOptions(optionsAddress);

        uint256 profit = exerciseProfit(optionsAddress, optionID, amount);

        options.exercise(optionID);

        if (optionsAddress == address(ethOptions)) {
            (bool success, ) = account.call{value: profit}("");
            require(success, "Failed transfer");
        } else {
            IERC20 wbtc = IERC20(wbtcAddress);
            wbtc.safeTransfer(account, profit);
        }

        emit Exercised(account, optionsAddress, optionID, amount, profit);
    }

    function createShort(OptionTerms memory optionTerms, uint256 amount)
        public
        payable
        override
        returns (uint256)
    {
        return 0;
    }

    function _swapWBTCToETH(uint256 costWBTC, uint256 costETH) internal {
        IERC20(wbtcAddress).safeTransferFrom(
            msg.sender,
            address(ethWbtcPair),
            costWBTC
        ); // send WBTC directly to the Uniswap Pair (requires approval of WBTC)
        uint256 amount0Out;
        uint256 amount1Out;
        (amount0Out, amount1Out) = (uint256(0), costETH); // in case we change tokens (currently using WETH<>WBTC pair) this should be reviewed
        ethWbtcPair.swap(amount0Out, amount1Out, address(this), "");
        IWETH(wethAddress).withdraw(costETH); // unwrapping ETH. It would not be required if options are paid using WETH
    }

    // from UniswapV2Library
    function _getAmountsIn(uint256 amountOut)
        internal
        view
        returns (uint256 amountIn)
    {
        uint256 reserveIn;
        uint256 reserveOut;
        (uint256 reserve0, uint256 reserve1, ) = ethWbtcPair.getReserves();
        (reserveIn, reserveOut) = (reserve0, reserve1);
        // getAmountIn
        require(amountOut > 0, "UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
        );

        uint256 numerator = reserveIn.mul(amountOut).mul(1000);
        uint256 denominator = reserveOut.sub(amountOut).mul(997);
        amountIn = (numerator / denominator).add(1);
    }

    /**
     * @notice Function to bulk claim rHEGIC2 rewards from liquidity utilization
     * @param rewardsAddress is the address of the rewards contract (either for eth or wbtc)
     * @param optionIDs is an array of all the option ids we want to claim rewards for
     */
    function claimRewards(address rewardsAddress, uint256[] calldata optionIDs)
        external
    {
        IHegicRewards rewardsContract = IHegicRewards(rewardsAddress);
        uint256 i = 0;
        while (i < optionIDs.length) {
            rewardsContract.getReward(optionIDs[i]);
            i += 1;
        }
    }

    function createShort(OptionTerms memory optionTerms, uint256 amount)
        public
        payable
        override
    {}

    /**
     * @notice Helper function to get the options address based on the underlying asset
     * @param underlying is the underlying asset for the options
     */
    function getHegicOptions(address underlying)
        private
        view
        returns (IHegicOptions)
    {
        if (underlying == ethAddress) {
            return ethOptions;
        } else if (underlying == wbtcAddress) {
            return wbtcOptions;
        }
        require(false, "No matching options contract");
    }

    /**
     * @notice Helper function to scale down strike prices from 10**18 to 10**8
     * @param strikePrice is the strikePrice in 10**18
     */
    function scaleDownStrikePrice(uint256 strikePrice)
        private
        pure
        returns (uint256)
    {
        // converts strike price in 10**18 to 10**8
        return strikePrice.div(10**10);
    }
}
