// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    OptionType,
    IProtocolAdapter,
    OptionTerms
} from "./IProtocolAdapter.sol";
import {InstrumentStorageV1} from "../storage/InstrumentStorage.sol";
import {
    OtokenFactory,
    OtokenInterface
} from "../interfaces/OtokenInterface.sol";
import {IZeroExExchange, Order} from "../interfaces/IZeroExExchange.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import "../tests/DebugLib.sol";

contract GammaAdapter is IProtocolAdapter, InstrumentStorageV1, DebugLib {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable zeroExExchange;
    address public immutable oTokenFactory;
    address private immutable _weth;
    address private immutable _router;

    constructor(
        address _oTokenFactory,
        address weth,
        address _zeroExExchange,
        address router
    ) public {
        oTokenFactory = _oTokenFactory;
        zeroExExchange = _zeroExExchange;
        _weth = weth;
        _router = router;
    }

    function protocolName() external pure override returns (string memory) {
        return "OPYN_GAMMA";
    }

    function nonFungible() external pure override returns (bool) {
        return false;
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
        return false;
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
        return address(0);
    }

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     * @param optionTerms is the terms of the option contract
     * @param purchaseAmount is the purchase amount in Wad units (10**18)
     */
    function premium(OptionTerms calldata optionTerms, uint256 purchaseAmount)
        external
        view
        override
        returns (uint256 cost)
    {
        return 0;
    }

    /**
     * @notice Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.
     * @param options is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     */
    function exerciseProfit(
        address options,
        uint256 optionID,
        uint256 amount
    ) external view override returns (uint256 profit) {
        return 0;
    }

    /**
     * @notice Purchases the options contract.
     * @param optionTerms is the terms of the option contract
     * @param amount is the purchase amount in Wad units (10**18)
     */
    function purchase(OptionTerms calldata optionTerms, uint256 amount)
        external
        payable
        override
        returns (uint256 optionID)
    {}

    function purchaseWithZeroEx(
        OptionTerms calldata optionTerms,
        address proxyAddress,
        address buyTokenAddress,
        address sellTokenAddress,
        Order calldata order,
        bytes calldata signature,
        address allowanceTarget,
        uint256 protocolFee
    ) external payable {
        IUniswapV2Router02 router = IUniswapV2Router02(_router);

        address[] memory path = new address[](2);
        path[0] = _weth;
        path[1] = sellTokenAddress;

        // uint256[] memory amounts =
        //     router.getAmountsIn(order.takerAssetAmount, path);
        uint256[] memory amounts =
            router.getAmountsIn(order.takerAssetAmount * 2, path);

        require(msg.value >= amounts[0], "Not enough value to swap");

        router.swapETHForExactTokens{value: amounts[0]}(
            order.takerAssetAmount * 2,
            path,
            address(this),
            block.timestamp + 10000
        );

        require(
            IERC20(sellTokenAddress).balanceOf(address(this)) >=
                order.takerAssetAmount,
            "Not enough takerAsset balance"
        );
        IERC20(sellTokenAddress).safeApprove(
            allowanceTarget,
            order.takerAssetAmount * 2
        );

        require(
            IERC20(buyTokenAddress).balanceOf(order.makerAddress) >=
                order.makerAssetAmount,
            "Not enough marketAsset balance"
        );
        require(
            address(this).balance >= protocolFee,
            "Enough to cover protocolFee"
        );
        require(block.timestamp < order.expirationTimeSeconds, "expired");

        IZeroExExchange(proxyAddress).fillOrder{value: protocolFee}(
            order,
            1,
            signature
        );
    }

    /**
     * @notice Exercises the options contract.
     * @param options is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     * @param recipient is the account that receives the exercised profits. This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address options,
        uint256 optionID,
        uint256 amount,
        address recipient
    ) external payable override {}

    /**
     * @notice Function to lookup oToken addresses. oToken addresses are keyed by an ABI-encoded byte string
     * @param optionTerms is the terms of the option contract
     */
    function lookupOToken(OptionTerms memory optionTerms)
        public
        view
        returns (address oToken)
    {
        OtokenFactory factory = OtokenFactory(oTokenFactory);

        bool isPut = optionTerms.optionType == OptionType.Put;
        address underlying = optionTerms.underlying;

        if (
            optionTerms.underlying == address(0) ||
            optionTerms.underlying == _weth
        ) {
            underlying = _weth;
        }

        oToken = factory.getOtoken(
            underlying,
            optionTerms.strikeAsset,
            optionTerms.collateralAsset,
            optionTerms.strikePrice.div(10**10),
            optionTerms.expiry,
            isPut
        );
    }
}
