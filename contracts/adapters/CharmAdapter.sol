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
    IOptionMarket,
    IOptionToken,
    IOptionViews,
    IOptionRegistry
} from "../interfaces/CharmInterface.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {UniERC20} from "../lib/UniERC20.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";

contract CharmAdapter is IProtocolAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using UniERC20 for IERC20;

    IOptionViews public immutable optionViews;
    IOptionRegistry public immutable optionRegistry;

    // _swapWindow is the number of seconds in which a Uniswap swap is valid from block.timestamp.
    uint256 private constant SWAP_WINDOW = 900;

    string private constant _name = "CHARM";
    bool private constant _nonFungible = false;

    // UNISWAP_ROUTER is Uniswap's periphery contract for conducting trades.
    // Using this contract is gas inefficient and should only used
    // for convenience i.e. admin functions
    address private constant UNISWAP_ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    constructor(address _optionViews, address _optionRegistry) {
        require(_optionViews != address(0), "!_optionViews");
        require(_optionRegistry != address(0), "!_optionRegistry");
        optionViews = IOptionViews(_optionViews);
        optionRegistry = IOptionRegistry(_optionRegistry);
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
        return address(lookupCToken(optionTerms)) != address(0);
    }

    /**
     * @notice Get the options contract's address based on the passed parameters
     * @param optionTerms is the terms of the option contract
     */
    function getOptionsAddress(
        ProtocolAdapterTypes.OptionTerms calldata optionTerms
    ) external view override returns (address) {
        return address(lookupCToken(optionTerms));
    }

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     */
    function premium(
        ProtocolAdapterTypes.OptionTerms calldata optionTerms,
        uint256 purchaseAmount
    ) external view override returns (uint256 cost) {
        address tokenAddress = lookupCToken(optionTerms);

        require(tokenAddress != address(0), "Must be valid option terms!");

        //get token
        IOptionToken token = IOptionToken(tokenAddress);

        // Get strike index, whether is long
        IOptionRegistry.OptionDetails memory optionType =
            optionRegistry.getOptionDetails(token);

        //get market
        IOptionMarket market = IOptionMarket(token.market());

        cost = optionViews.getBuyOptionCost(
            market,
            optionType.isLongToken,
            optionType.strikeIndex,
            purchaseAmount.mul(10**token.decimals()).div(10**18)
        );
    }

    /**
     * @notice Amount of profit made from exercising an option
     * contract (current price - strike price). 0 if exercising out-the-money.
     * @param options is the address of the options contract
     * @param amount is the amount of tokens or options contract to exercise.
     */
    function exerciseProfit(
        address options,
        uint256,
        uint256 amount
    ) public view override returns (uint256) {
        //get token
        IOptionToken token = IOptionToken(options);
        //get market
        IOptionMarket market = IOptionMarket(token.market());

        // Get strike index, whether is long
        IOptionRegistry.OptionDetails memory optionType =
            optionRegistry.getOptionDetails(IOptionToken(options));

        //profit of exercising
        try
            optionViews.getSellOptionCost(
                market,
                optionType.isLongToken,
                optionType.strikeIndex,
                amount.mul(10**token.decimals()).div(10**18)
            )
        returns (uint256 v) {
            return v;
        } catch {
            return 0;
        }
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
        address tokenAddress = lookupCToken(optionTerms);
        if (tokenAddress == address(0)) {
            try optionRegistry.populateMarkets() {} catch {}
            tokenAddress = lookupCToken(optionTerms);
            require(tokenAddress != address(0), "Market needs to exist!");
        }

        //get token
        IOptionToken token = IOptionToken(tokenAddress);

        // Get strike index, whether is long
        IOptionRegistry.OptionDetails memory optionType =
            optionRegistry.getOptionDetails(token);

        //get market
        IOptionMarket market = IOptionMarket(token.market());
        IERC20 baseToken =
            IERC20(
                optionTerms.optionType == ProtocolAdapterTypes.OptionType.Put
                    ? optionTerms.strikeAsset
                    : optionTerms.underlying
            );

        bool isETH = address(baseToken) == address(0);

        if (!isETH) {
            _swapETHToBaseToken(baseToken, maxCost, market);
        }

        uint256 shiftedAmount = amount.mul(10**token.decimals()).div(10**18);

        uint256 amountIn =
            market.buy{value: isETH ? address(this).balance : 0}(
                optionType.isLongToken,
                optionType.strikeIndex,
                shiftedAmount,
                maxCost
            );

        emit Purchased(msg.sender, _name, optionTerms.underlying, amountIn, 0);
    }

    /**
     * @notice Exercises the options contract.
     * @param options is the address of the options contract
     * @param amount is the amount of tokens or options contract to exercise.
     *              Only relevant for fungle protocols like Opyn or Charm
     * @param recipient is the account that receives the exercised profits.
     * This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address options,
        uint256,
        uint256 amount,
        address recipient
    ) public payable override {
        // Get strike index, whether is long
        IOptionRegistry.OptionDetails memory optionType =
            optionRegistry.getOptionDetails(IOptionToken(options));

        //get token
        IOptionToken token = IOptionToken(options);
        //get market
        IOptionMarket market = IOptionMarket(token.market());

        // if we are exercising but market has not settled, do it
        if (market.isExpired() && !market.isSettled()) {
            market.settle();
        }

        uint256 profit = exerciseProfit(options, 0, amount);
        require(profit > 0, "Not profitable to exercise");

        uint256 amountOut =
            market.sell(
                optionType.isLongToken,
                optionType.strikeIndex,
                amount.mul(10**token.decimals()).div(10**18),
                profit
            );

        uint256 profitInUnderlying =
            _swapExercisedProfitsToUnderlying(
                market.baseToken(),
                amountOut,
                recipient
            );

        emit Exercised(
            msg.sender,
            options,
            0,
            amount.mul(10**token.decimals()).div(10**18),
            profitInUnderlying
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
     * @notice Function to lookup cToken addresses.
     * @param optionTerms is the terms of the option contract
     */
    function lookupCToken(ProtocolAdapterTypes.OptionTerms memory optionTerms)
        public
        view
        returns (address token)
    {
        bool isPut =
            optionTerms.optionType == ProtocolAdapterTypes.OptionType.Put;

        //there should only be a collateral asset for charm if we are writing an option
        bool isLong = optionTerms.collateralAsset == address(1) ? true : false;

        token = address(
            optionRegistry.getOption(
                IERC20(optionTerms.underlying),
                optionTerms.expiry,
                isPut,
                optionTerms.strikePrice,
                isLong
            )
        );
    }

    /**
     * @notice Swaps the exercised profit (originally in the collateral token) into the `underlying` token.
     *         This simplifies the payout of an option. Put options pay out in USDC, so we swap USDC back
     *         into WETH and transfer it to the recipient.
     * @param baseToken is the base token of the market
     * @param profitInBaseToken is the profit after exercising denominated in the base token
     *                          - this could be a token with different decimals
     * @param recipient is the recipient of the underlying tokens after the swap
     */
    function _swapExercisedProfitsToUnderlying(
        IERC20 baseToken,
        uint256 profitInBaseToken,
        address recipient
    ) private returns (uint256 profitInUnderlying) {
        require(
            baseToken.uniBalanceOf(address(this)) >= profitInBaseToken,
            "Not enough collateral from exercising"
        );

        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAP_ROUTER);

        if (address(baseToken) == address(0)) {
            (bool success, ) = recipient.call{value: profitInBaseToken}("");
            require(success, "Failed to transfer exercise profit");
        } else {
            address[] memory path = new address[](2);
            path[0] = address(baseToken);
            path[1] = address(WETH);

            uint256[] memory amountsOut =
                router.getAmountsOut(profitInBaseToken, path);
            profitInUnderlying = amountsOut[1];

            require(profitInUnderlying > 0, "Swap is unprofitable");

            baseToken.safeApprove(address(router), profitInBaseToken);

            router.swapExactTokensForETH(
                profitInBaseToken,
                profitInUnderlying,
                path,
                recipient,
                block.timestamp + SWAP_WINDOW
            );
        }
    }

    /**
     * @notice Swaps the ETH into the `base` token.
     *         This simplifies the buying of an option since you only pay in ETH for any option
     * @param baseToken is the base token of the market
     * @param _premium premium to buy option
     * @param market market of token
     */
    function _swapETHToBaseToken(
        IERC20 baseToken,
        uint256 _premium,
        IOptionMarket market
    ) private {
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAP_ROUTER);

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = address(baseToken);

        router.swapETHForExactTokens{value: address(this).balance}(
            _premium,
            path,
            address(this),
            block.timestamp + SWAP_WINDOW
        );

        uint256 balanceOfToken = baseToken.uniBalanceOf(address(this));
        baseToken.safeApprove(address(market), balanceOfToken);
    }
}
