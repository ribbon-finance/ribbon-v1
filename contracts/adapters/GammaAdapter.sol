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
    IOtokenFactory,
    OtokenInterface,
    IController,
    OracleInterface,
    GammaTypes
} from "../interfaces/GammaInterface.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import {DSMath} from "../lib/DSMath.sol";

contract GammaAdapter is IProtocolAdapter, DSMath {
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
    address private constant _marginPool =
        0x5934807cC0654d46755eBd2848840b616256C6Ef;
    uint256 private constant OTOKEN_DECIMALS = 10**8;
    AggregatorV3Interface private constant _USDCETHPriceFeed =
        AggregatorV3Interface(0x986b5E1e1755e3C2440e960477f25201B0a8bbD4);
    address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address private constant ZERO_EX_EXCHANGE_V3 =
        0xDef1C0ded9bec7F1a1670819833240f027b25EfF;

    constructor(
        address _oTokenFactory,
        address _gammaController,
        address weth,
        address _zeroExExchange,
        address router
    ) {
        require(_oTokenFactory != address(0), "!_oTokenFactory");
        require(_zeroExExchange != address(0), "!_zeroExExchange");
        require(_gammaController != address(0), "!_gammaController");
        require(weth != address(0), "!weth");
        require(router != address(0), "!router");
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

    function purchaseMethod()
        external
        pure
        override
        returns (ProtocolAdapterTypes.PurchaseMethod)
    {
        return ProtocolAdapterTypes.PurchaseMethod.ZeroEx;
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
    function premium(ProtocolAdapterTypes.OptionTerms calldata, uint256)
        external
        pure
        override
        returns (uint256 cost)
    {
        return 0;
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

    function canExercise(
        address options,
        uint256 optionID,
        uint256 amount
    ) public view override returns (bool) {
        OtokenInterface otoken = OtokenInterface(options);

        if (block.timestamp < otoken.expiryTimestamp()) {
            return false;
        }
        if (exerciseProfit(options, optionID, amount) > 0) {
            return true;
        }
        return false;
    }

    /**
     * @notice Purchases the options contract.
     */
    function purchase(
        ProtocolAdapterTypes.OptionTerms calldata,
        uint256,
        uint256
    ) external payable override returns (uint256) {}

    function purchaseWithZeroEx(
        ProtocolAdapterTypes.OptionTerms calldata optionTerms,
        ProtocolAdapterTypes.ZeroExOrder calldata zeroExOrder
    ) external payable {
        require(
            msg.value >= zeroExOrder.protocolFee,
            "Value cannot cover protocolFee"
        );

        IUniswapV2Router02 router = IUniswapV2Router02(_router);

        address[] memory path = new address[](2);
        path[0] = _weth;
        path[1] = zeroExOrder.sellTokenAddress;

        (, int256 latestPrice, , , ) = _USDCETHPriceFeed.latestRoundData();

        uint256 soldETH =
            zeroExOrder.takerAssetAmount.mul(uint256(latestPrice)).div(10**6);

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

        require(
            address(this).balance >= zeroExOrder.protocolFee,
            "Not enough balance for protocol fee"
        );

        (bool success, ) =
            ZERO_EX_EXCHANGE_V3.call{value: zeroExOrder.protocolFee}(
                zeroExOrder.swapData
            );

        require(success, "0x swap failed");

        require(
            IERC20(zeroExOrder.buyTokenAddress).balanceOf(address(this)) >=
                zeroExOrder.makerAssetAmount,
            "Not enough buyToken balance"
        );

        emit Purchased(
            msg.sender,
            _name,
            optionTerms.underlying,
            soldETH.add(zeroExOrder.protocolFee),
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

        require(
            block.timestamp >= otoken.expiryTimestamp(),
            "oToken not expired yet"
        );

        uint256 scaledAmount = amount.div(10**10);
        uint256 profit = exerciseProfit(options, optionID, amount);
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

    function createShort(
        ProtocolAdapterTypes.OptionTerms calldata optionTerms,
        uint256 depositAmount
    ) external override returns (uint256) {
        IController controller = IController(gammaController);
        uint256 newVaultID =
            (controller.getAccountVaultCounter(address(this))).add(1);

        address oToken = lookupOToken(optionTerms);
        require(oToken != address(0), "Invalid oToken");

        address collateralAsset = optionTerms.collateralAsset;
        if (collateralAsset == address(0)) {
            collateralAsset = _weth;
        }
        IERC20 collateralToken = IERC20(collateralAsset);

        uint256 collateralDecimals = assetDecimals(collateralAsset);
        uint256 mintAmount;

        if (optionTerms.optionType == ProtocolAdapterTypes.OptionType.Call) {
            mintAmount = depositAmount;
            if (collateralDecimals >= 8) {
                uint256 scaleBy = 10**(collateralDecimals - 8); // oTokens have 8 decimals
                mintAmount = depositAmount.div(scaleBy); // scale down from 10**18 to 10**8
                require(
                    mintAmount > 0,
                    "Must deposit more than 10**8 collateral"
                );
            }
        } else {
            mintAmount = wdiv(depositAmount, optionTerms.strikePrice)
                .mul(OTOKEN_DECIMALS)
                .div(10**collateralDecimals);
        }

        collateralToken.safeApprove(_marginPool, depositAmount);

        IController.ActionArgs[] memory actions =
            new IController.ActionArgs[](3);

        actions[0] = IController.ActionArgs(
            IController.ActionType.OpenVault,
            address(this), // owner
            address(this), // receiver -  we need this contract to receive so we can swap at the end
            address(0), // asset, otoken
            newVaultID, // vaultId
            0, // amount
            0, //index
            "" //data
        );

        actions[1] = IController.ActionArgs(
            IController.ActionType.DepositCollateral,
            address(this), // owner
            address(this), // address to transfer from
            collateralAsset, // deposited asset
            newVaultID, // vaultId
            depositAmount, // amount
            0, //index
            "" //data
        );

        actions[2] = IController.ActionArgs(
            IController.ActionType.MintShortOption,
            address(this), // owner
            address(this), // address to transfer to
            oToken, // deposited asset
            newVaultID, // vaultId
            mintAmount, // amount
            0, //index
            "" //data
        );

        controller.operate(actions);

        return mintAmount;
    }

    function closeShort() external override returns (uint256) {
        IController controller = IController(gammaController);

        // gets the currently active vault ID
        uint256 vaultID = controller.getAccountVaultCounter(address(this));

        GammaTypes.Vault memory vault =
            controller.getVault(address(this), vaultID);

        require(vault.collateralAssets.length > 0, "No active vault");

        IERC20 collateralToken = IERC20(vault.collateralAssets[0]);
        uint256 startCollateralBalance =
            collateralToken.balanceOf(address(this));

        IController.ActionArgs[] memory actions =
            new IController.ActionArgs[](1);

        actions[0] = IController.ActionArgs(
            IController.ActionType.SettleVault,
            address(this), // owner
            address(this), // address to transfer to
            address(0), // not used
            vaultID, // vaultId
            0, // not used
            0, // not used
            "" // not used
        );

        controller.operate(actions);

        uint256 endCollateralBalance = collateralToken.balanceOf(address(this));

        return endCollateralBalance.sub(startCollateralBalance);
    }

    function assetDecimals(address asset) private pure returns (uint256) {
        // USDC
        if (asset == USDC) {
            return 6;
        }
        return 18;
    }

    /**
     * @notice Function to lookup oToken addresses. oToken addresses are keyed by an ABI-encoded byte string
     * @param optionTerms is the terms of the option contract
     */
    function lookupOToken(ProtocolAdapterTypes.OptionTerms memory optionTerms)
        public
        view
        returns (address oToken)
    {
        IOtokenFactory factory = IOtokenFactory(oTokenFactory);

        bool isPut =
            optionTerms.optionType == ProtocolAdapterTypes.OptionType.Put;
        address underlying = optionTerms.underlying;

        if (optionTerms.underlying == address(0)) {
            underlying = _weth;
        }

        // Put otokens have USDC as the backing collateral
        // so we can ignore the collateral asset passed in option terms
        address collateralAsset;
        if (isPut) {
            collateralAsset = USDC;
        } else {
            collateralAsset = underlying;
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
