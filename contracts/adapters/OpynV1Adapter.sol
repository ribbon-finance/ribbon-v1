// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import {
    IOToken,
    IOptionsExchange,
    IUniswapFactory,
    UniswapExchangeInterface,
    CompoundOracleInterface
} from "../interfaces/OpynV1Interface.sol";
import {IProtocolAdapter, OptionType} from "./IProtocolAdapter.sol";
import {
    ILendingPool,
    ILendingPoolAddressesProvider
} from "../lib/aave/Interfaces.sol";
import {OpynV1FlashLoaner} from "./OpynV1FlashLoaner.sol";

contract OpynV1Adapter is IProtocolAdapter, ReentrancyGuard, OpynV1FlashLoaner {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    string private constant _name = "OPYN_V1";
    bool private constant _nonFungible = false;
    uint256 private constant _swapDeadline = 900; // 15 minutes

    constructor(ILendingPoolAddressesProvider _addressProvider)
        public
        OpynV1FlashLoaner(_addressProvider)
    {}

    function initialize(
        address _owner,
        address _dojiFactory,
        ILendingPoolAddressesProvider _provider,
        address router,
        address weth
    ) public initializer {
        owner = _owner;
        dojiFactory = _dojiFactory;
        _addressesProvider = _provider;
        _lendingPool = ILendingPool(
            ILendingPoolAddressesProvider(_provider).getLendingPool()
        );
        _uniswapRouter = router;
        _weth = weth;
    }

    function protocolName() public override pure returns (string memory) {
        return _name;
    }

    function nonFungible() external override pure returns (bool) {
        return _nonFungible;
    }

    function optionsExist(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) public override view returns (bool) {
        address oToken = lookupOToken(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        return oToken != address(0);
    }

    function getOptionsAddress(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) external override view returns (address) {
        address oToken = lookupOToken(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );

        require(oToken != address(0), "No oToken found");
        return oToken;
    }

    function premium(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 purchaseAmount
    ) public override view returns (uint256 cost) {
        address oToken = lookupOToken(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        UniswapExchangeInterface uniswapExchange = getUniswapExchangeFromOToken(
            oToken
        );
        uint256 oTokenAmount = convertPurchaseAmountToOTokenAmount(
            oToken,
            strikePrice
        );
        cost = uniswapExchange.getEthToTokenOutputPrice(oTokenAmount);
    }

    function exerciseProfit(
        address oToken,
        uint256 optionID,
        uint256 exerciseAmount
    ) public override view returns (uint256 profit) {
        IOToken oTokenContract = IOToken(oToken);
        address oTokenCollateral = oTokenContract.collateral();

        uint256 scaledExerciseAmount = convertPurchaseAmountToOTokenAmount(
            oToken,
            exerciseAmount
        );

        uint256 strikeAmountOut = getStrikeAssetOutAmount(
            oTokenContract,
            scaledExerciseAmount
        );
        uint256 collateralToPay = OpynV1FlashLoaner.calculateCollateralToPay(
            oTokenContract,
            scaledExerciseAmount
        );
        uint256 soldCollateralAmount = getSoldCollateralAmount(
            oTokenContract,
            scaledExerciseAmount
        );

        // if we exercised here, the collateral returned will be less than what Uniswap is giving us
        // which means we're at a loss, so don't exercise
        if (collateralToPay < strikeAmountOut) {
            return 0;
        }
        uint256 profitInCollateral = collateralToPay.sub(soldCollateralAmount);

        address underlying = _underlyingAssets[oToken];

        if (oTokenCollateral != underlying) {
            address[] memory path = new address[](2);
            path[0] = oTokenCollateral;
            path[1] = underlying;

            uint256[] memory amountsOut = IUniswapV2Router02(_uniswapRouter)
                .getAmountsOut(profitInCollateral, path);
            return amountsOut[1];
        }
        return profitInCollateral;
    }

    function purchase(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 amount
    )
        external
        override
        payable
        nonReentrant
        onlyInstrument
        returns (uint256 optionID)
    {
        uint256 cost = premium(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            amount
        );
        require(msg.value >= cost, "Value does not cover cost");

        address oToken = lookupOToken(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );

        require(!IOToken(oToken).hasExpired(), "Options contract expired");

        uint256 scaledAmount = convertPurchaseAmountToOTokenAmount(
            oToken,
            strikePrice
        );
        swapForOToken(oToken, cost, scaledAmount);

        emit Purchased(
            msg.sender,
            _name,
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType,
            scaledAmount,
            cost,
            0
        );
    }

    function swapForOToken(
        address oToken,
        uint256 tokenCost,
        uint256 purchaseAmount
    ) private {
        uint256 ethSold = getUniswapExchangeFromOToken(oToken)
            .ethToTokenSwapOutput{value: tokenCost}(
            purchaseAmount,
            block.timestamp + _swapDeadline
        );

        (bool changeSuccess, ) = msg.sender.call{value: msg.value - ethSold}(
            ""
        );
        require(changeSuccess, "Transfer of change failed");
    }

    function exercise(
        address oToken,
        uint256 optionID,
        uint256 amount,
        address recipient
    ) external override payable onlyInstrument nonReentrant {
        IOToken oTokenContract = IOToken(oToken);
        require(!oTokenContract.hasExpired(), "Options contract expired");
        uint256 scaledAmount = convertPurchaseAmountToOTokenAmount(
            oToken,
            amount
        );
        OpynV1FlashLoaner.exerciseOTokens(
            recipient,
            oToken,
            scaledAmount,
            _underlyingAssets[oToken]
        );
    }

    function setOTokenWithTerms(
        uint256 strikePrice,
        OptionType optionType,
        address oToken
    ) external onlyOwner {
        IOToken oTokenContract = IOToken(oToken);

        (address underlying, address strikeAsset) = getAssets(
            oTokenContract,
            optionType
        );
        uint256 expiry = oTokenContract.expiry();

        bytes memory optionTerms = abi.encode(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        optionTermsToOToken[optionTerms] = oToken;
        _strikePrices[oToken] = strikePrice;
        _underlyingAssets[oToken] = underlying;
    }

    function getAssets(IOToken oTokenContract, OptionType optionType)
        private
        view
        returns (address underlying, address strikeAsset)
    {
        if (optionType == OptionType.Call) {
            underlying = oTokenContract.collateral();
            strikeAsset = oTokenContract.underlying();
        } else if (optionType == OptionType.Put) {
            underlying = oTokenContract.underlying();
            strikeAsset = oTokenContract.collateral();
        }
    }

    function setVaults(address oToken, address payable[] memory vaultOwners)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < vaultOwners.length; i++) {
            vaults[oToken].push(vaultOwners[i]);
        }
    }

    function lookupOToken(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) public view returns (address oToken) {
        bytes memory optionTerms = abi.encode(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        return optionTermsToOToken[optionTerms];
    }

    function getUniswapExchangeFromOToken(address oToken)
        private
        view
        returns (UniswapExchangeInterface uniswapExchange)
    {
        IOptionsExchange optionsExchange = IOToken(oToken).optionsExchange();
        IUniswapFactory uniswapFactory = optionsExchange.UNISWAP_FACTORY();
        uniswapExchange = UniswapExchangeInterface(
            uniswapFactory.getExchange(oToken)
        );
    }

    function getStrikeAssetOutAmount(IOToken oToken, uint256 exerciseAmount)
        private
        view
        returns (uint256)
    {
        address weth = _weth;
        address strikeAsset = oToken.strike();
        strikeAsset = strikeAsset == address(0) ? weth : strikeAsset;
        address oTokenUnderlying = oToken.underlying();
        oTokenUnderlying = oTokenUnderlying == address(0)
            ? weth
            : oTokenUnderlying;

        address[] memory path;
        if (strikeAsset == weth || oTokenUnderlying == weth) {
            path = new address[](2);
            path[0] = oTokenUnderlying;
            path[1] = strikeAsset;
        } else {
            path = new address[](3);
            path[0] = oTokenUnderlying;
            path[1] = weth;
            path[2] = strikeAsset;
        }

        uint256[] memory amountsOut = IUniswapV2Router02(_uniswapRouter)
            .getAmountsOut(
            exerciseAmount.mul(10**uint256(-oToken.underlyingExp())).div(
                10**oToken.decimals()
            ),
            path
        );
        return amountsOut[path.length - 1];
    }

    function getSoldCollateralAmount(IOToken oToken, uint256 exerciseAmount)
        private
        view
        returns (uint256)
    {
        address weth = _weth;
        address collateral = oToken.collateral();
        address underlying = oToken.underlying();
        collateral = collateral == address(0) ? weth : collateral;
        underlying = underlying == address(0) ? weth : underlying;

        uint256 underlyingAmount = oToken.underlyingRequiredToExercise(
            exerciseAmount
        );
        // https://github.com/aave/protocol-v2/blob/master/contracts/protocol/lendingpool/LendingPool.sol#L54
        uint256 loanFee = wmul(underlyingAmount, 0.0009 ether);

        address[] memory path;
        if (collateral == weth || underlying == weth) {
            path = new address[](2);
            path[0] = collateral;
            path[1] = underlying;
        } else {
            path = new address[](3);
            path[0] = collateral;
            path[1] = weth;
            path[2] = underlying;
        }
        uint256[] memory amountsIn = IUniswapV2Router02(_uniswapRouter)
            .getAmountsIn(underlyingAmount.add(loanFee), path);
        return amountsIn[0];
    }

    function convertPurchaseAmountToOTokenAmount(
        address oToken,
        uint256 purchaseAmount
    ) private view returns (uint256) {
        uint256 strike = _strikePrices[oToken];
        IOToken oTokenContract = IOToken(oToken);
        address oTokenUnderlying = oTokenContract.underlying();
        OptionType optionType = getOptionType(oTokenUnderlying);

        uint256 oTokenAmount = optionType == OptionType.Call
            ? wmul(purchaseAmount, strike)
            : purchaseAmount;
        return scaleDownDecimals(oTokenContract, oTokenAmount);
    }

    function getOptionType(address oTokenUnderlying)
        private
        view
        returns (OptionType)
    {
        return
            oTokenUnderlying == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
                ? OptionType.Call
                : OptionType.Put;
    }
}
