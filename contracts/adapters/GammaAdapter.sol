// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    OptionType,
    IProtocolAdapter,
    OptionTerms,
    ZeroExOrder,
    PurchaseMethod
} from "./IProtocolAdapter.sol";
import {InstrumentStorageV1} from "../storage/InstrumentStorage.sol";
import {
    IOtokenFactory,
    OtokenInterface,
    IController,
    OracleInterface
} from "../interfaces/GammaInterface.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import "../tests/DebugLib.sol";

contract GammaAdapter is IProtocolAdapter, InstrumentStorageV1, DebugLib {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable zeroExExchange;
    address public immutable gammaController;
    address public immutable oTokenFactory;
    address private immutable _weth;
    address private immutable _router;
    uint256 private constant _swapWindow = 900;

    string private constant _name = "OPYN_GAMMA";
    bool private constant _nonFungible = false;
    bool private constant _isEuropean = false;

    constructor(
        address _oTokenFactory,
        address _gammaController,
        address weth,
        address _zeroExExchange,
        address router
    ) public {
        oTokenFactory = _oTokenFactory;
        zeroExExchange = _zeroExExchange;
        gammaController = _gammaController;
        _weth = weth;
        _router = router;
    }

    receive() external payable {}

    function protocolName() external pure override returns (string memory) {
        return _name;
    }

    function nonFungible() external pure override returns (bool) {
        return _nonFungible;
    }

    function purchaseMethod() external pure override returns (PurchaseMethod) {
        return PurchaseMethod.ZeroEx;
    }

    function isEuropean() external pure override returns (bool) {
        return _isEuropean;
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
        return lookupOToken(optionTerms) != address(0);
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
        return lookupOToken(optionTerms);
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
    ) public view override returns (uint256 profit) {
        IController controller = IController(gammaController);
        OracleInterface oracle = OracleInterface(controller.oracle());
        OtokenInterface otoken = OtokenInterface(options);

        require(
            block.timestamp >= otoken.expiryTimestamp(),
            "oToken not expired yet"
        );

        uint256 spotPrice = oracle.getPrice(otoken.underlyingAsset());
        uint256 strikePrice = otoken.strikePrice();
        bool isPut = otoken.isPut();

        if (!isPut && spotPrice <= strikePrice) {
            return 0;
        } else if (isPut && spotPrice >= strikePrice) {
            return 0;
        }

        return controller.getPayout(options, amount.div(10**10));
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
        ZeroExOrder calldata zeroExOrder
    ) external payable {
        require(
            msg.value >= zeroExOrder.protocolFee,
            "Value cannot cover protocolFee"
        );

        IUniswapV2Router02 router = IUniswapV2Router02(_router);

        address[] memory path = new address[](2);
        path[0] = _weth;
        path[1] = zeroExOrder.sellTokenAddress;
        uint256[] memory amountsIn =
            router.getAmountsIn(zeroExOrder.takerAssetAmount, path);

        uint256 soldETH = amountsIn[0];
        uint256 totalCost = soldETH.add(zeroExOrder.protocolFee);

        require(msg.value >= totalCost, "Not enough value to purchase");

        router.swapETHForExactTokens{value: soldETH}(
            zeroExOrder.takerAssetAmount,
            path,
            address(this),
            block.timestamp + _swapWindow
        );

        require(
            IERC20(zeroExOrder.sellTokenAddress).balanceOf(address(this)) >=
                zeroExOrder.takerAssetAmount,
            "Not enough takerAsset balance"
        );

        IERC20(zeroExOrder.sellTokenAddress).safeApprove(
            zeroExOrder.allowanceTarget,
            zeroExOrder.takerAssetAmount
        );

        (bool success, ) =
            zeroExOrder.exchangeAddress.call{value: zeroExOrder.protocolFee}(
                zeroExOrder.swapData
            );

        require(success, "0x swap failed");

        require(
            IERC20(zeroExOrder.buyTokenAddress).balanceOf(address(this)) >=
                zeroExOrder.makerAssetAmount,
            "Not enough buyToken balance"
        );

        // if (msg.value > totalCost) {
        //     uint256 change = msg.value.sub(totalCost);
        //     (bool changeSuccess, ) = msg.sender.call{value: change}("");
        //     require(changeSuccess, "Change transfer failed");
        // }

        emit Purchased(
            msg.sender,
            _name,
            optionTerms.underlying,
            optionTerms.strikeAsset,
            optionTerms.expiry,
            optionTerms.strikePrice,
            optionTerms.optionType,
            zeroExOrder.makerAssetAmount,
            totalCost,
            0
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
    ) public payable override {
        OtokenInterface otoken = OtokenInterface(options);
        uint256 scaledAmount = amount.div(10**10);
        uint256 profit = exerciseProfit(options, optionID, amount);

        require(
            block.timestamp >= otoken.expiryTimestamp(),
            "oToken not expired yet"
        );
        require(profit > 0, "Not profitable to exercise");

        IController.ActionArgs memory action =
            IController.ActionArgs(
                IController.ActionType.Redeem,
                address(this), // owner
                address(this), // receiver -  we need this contract to receive so we can swap at the end
                options, // asset, otoken
                0, // vaultId
                scaledAmount,
                0, //index
                "" //data
            );

        IController.ActionArgs[] memory actions =
            new IController.ActionArgs[](1);
        actions[0] = action;

        IController(gammaController).operate(actions);

        uint256 profitInUnderlying =
            swapExercisedProfitsToUnderlying(options, profit, recipient);

        emit Exercised(
            msg.sender,
            options,
            optionID,
            amount,
            profitInUnderlying
        );
    }

    function swapExercisedProfitsToUnderlying(
        address otokenAddress,
        uint256 profitInCollateral,
        address recipient
    ) private returns (uint256 profitInUnderlying) {
        OtokenInterface otoken = OtokenInterface(otokenAddress);
        address collateral = otoken.collateralAsset();
        IERC20 collateralToken = IERC20(collateral);

        require(
            collateralToken.balanceOf(address(this)) >= profitInCollateral,
            "Not enough collateral from exercising"
        );

        IUniswapV2Router02 router = IUniswapV2Router02(_router);

        IWETH weth = IWETH(_weth);

        if (collateral == address(weth)) {
            profitInUnderlying = profitInCollateral;
            weth.withdraw(profitInCollateral);
            (bool success, ) = recipient.call{value: profitInCollateral}("");
            require(success, "Failed to transfer exercise profit");
        } else {
            address[] memory path = new address[](2);
            path[0] = collateral;
            path[1] = address(weth);

            uint256[] memory amountsOut =
                router.getAmountsOut(profitInCollateral, path);
            profitInUnderlying = amountsOut[1];
            require(profitInUnderlying > 0, "Swap is unprofitable");

            router.swapExactTokensForETH(
                profitInCollateral,
                profitInUnderlying,
                path,
                recipient,
                block.timestamp + _swapWindow
            );
        }
    }

    /**
     * @notice Function to lookup oToken addresses. oToken addresses are keyed by an ABI-encoded byte string
     * @param optionTerms is the terms of the option contract
     */
    function lookupOToken(OptionTerms memory optionTerms)
        public
        view
        returns (address oToken)
    {
        IOtokenFactory factory = IOtokenFactory(oTokenFactory);

        bool isPut = optionTerms.optionType == OptionType.Put;
        address underlying = optionTerms.underlying;
        address collateralAsset = optionTerms.collateralAsset;

        if (
            optionTerms.underlying == address(0) ||
            optionTerms.underlying == _weth
        ) {
            underlying = _weth;
        }

        if (
            optionTerms.collateralAsset == address(0) ||
            optionTerms.collateralAsset == _weth
        ) {
            collateralAsset = _weth;
        }

        oToken = factory.getOtoken(
            underlying,
            optionTerms.strikeAsset,
            collateralAsset,
            optionTerms.strikePrice.div(10**10),
            optionTerms.expiry,
            isPut
        );
    }
}
