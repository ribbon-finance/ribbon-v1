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

    /**
     * @notice Constructor for Opyn v1 adapter
     * @param _addressProvider is the mainnet Aave address provider, used to look up lending pool addresses
     */
    constructor(ILendingPoolAddressesProvider _addressProvider)
        public
        OpynV1FlashLoaner(_addressProvider)
    {}

    /**
     * @notice Initializer for Opyn v1 adapter
     * @param _owner is the owner of the contract
     * @param _dojiFactory is the factory used to look up deployed instruments
     * @param _provider is the mainnet Aave address provider, used to look up lending pool addresses
     * @param router is the uniswap v2 router address
     * @param weth is the mainnet weth address
     */
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

    /**
     * @notice Check if an options contract exist based on the passed parameters.
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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

    /**
     * @notice Get the options contract's address based on the passed parameters
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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

    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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
            purchaseAmount
        );
        cost = uniswapExchange.getEthToTokenOutputPrice(oTokenAmount);
    }

    /**
     * @notice Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.
     * @param oToken is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param exerciseAmount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     */
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
            return
                getExercisedProfitsInUnderlyingAmount(
                    oTokenCollateral,
                    underlying,
                    profitInCollateral
                );
        }
        return profitInCollateral;
    }

    /**
     * @notice Purchases the options contract.
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     * @param amount is the purchase amount in Wad units (10**18)
     */
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
            amount
        );
        swapForOToken(oToken, cost, scaledAmount);

        totalOptions[msg.sender] += amount;

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

    /**
     * @notice Talking to Uniswap v1 pool to swap ETH for oTokens
     * @param oToken is the oToken address
     * @param tokenCost is the premium to be paid
     * @param purchaseAmount is the purchase amount in ETh
     */
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

        if (msg.value > ethSold) {
            (bool changeSuccess, ) = msg.sender.call{
                value: msg.value.sub(ethSold)
            }("");
            require(changeSuccess, "Transfer of change failed");
        }
    }

    /**
     * @notice Exercises the options contract.
     * @param oToken is the address of the options contract
     * @param optionID is the ID of the option position in non fungible protocols like Hegic.
     * @param amount is the amount of tokens or options contract to exercise. Only relevant for fungle protocols like Opyn
     * @param recipient is the account that receives the exercised profits. This is needed since the adapter holds all the positions and the msg.sender is an instrument contract.
     */
    function exercise(
        address oToken,
        uint256 optionID,
        uint256 amount,
        address recipient
    ) external override payable onlyInstrument nonReentrant {
        IOToken oTokenContract = IOToken(oToken);
        require(!oTokenContract.hasExpired(), "Option has expired");
        require(
            amount <= totalOptions[msg.sender],
            "Cannot exercise over capacity"
        );

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
        totalOptions[msg.sender] -= amount;
    }

    /**
     * @notice Sets an oToken with the terms. `strikePrice` and `optionType` are manually set. The rest are populated automatically with the oToken's parameters.
     * @param strikePrice is the strike price in USD terms (Wad)
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     * @param oToken is the oToken address
     */
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

    function getExercisedProfitsInUnderlyingAmount(
        address oTokenCollateral,
        address underlying,
        uint256 collateralAmount
    ) private view returns (uint256) {
        address weth = _weth;
        address[] memory path = new address[](2);
        path[0] = oTokenCollateral == address(0) ? weth : oTokenCollateral;
        path[1] = underlying == address(0) ? weth : underlying;

        uint256[] memory amountsOut = IUniswapV2Router02(_uniswapRouter)
            .getAmountsOut(collateralAmount, path);
        return amountsOut[1];
    }

    /**
     * @notice Helper function to lookup the collateral and underlying assets. In Opyn, the underlying and collaterals are inverted for Puts and Calls.
     * @param oTokenContract is the IOToken instance of the oToken
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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

        underlying = underlying == _weth ? address(0) : underlying;
        strikeAsset = strikeAsset == _weth ? address(0) : strikeAsset;
    }

    /**
     * @notice Since we cannot lookup the array of vaults automatically via the contract, we need to set the exercisable vaults for each oToken here.
     * @param oToken is the oToken address
     * @param vaultOwners is the array of exercisable vaults for an oToken
     */
    function setVaults(address oToken, address payable[] memory vaultOwners)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < vaultOwners.length; i++) {
            vaults[oToken].push(vaultOwners[i]);
        }
    }

    /**
     * @notice Function to lookup oToken addresses. oToken addresses are keyed by an ABI-encoded byte string
     * @param oToken is the oToken address
     * @param underlying is the underlying asset of the options. E.g. For ETH $800 CALL, ETH is the underlying.
     * @param strikeAsset is the asset used to denote the asset paid out when exercising the option. E.g. For ETH $800 CALL, USDC is the underlying.
     * @param expiry is the expiry of the option contract. Users can only exercise after expiry in Europeans.
     * @param strikePrice is the strike price of an optio contract. E.g. For ETH $800 CALL, 800*10**18 is the USDC.
     * @param optionType is the type of option, can only be OptionType.Call or OptionType.Put
     */
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

    /**
     * @notice Helper function to get the Uniswap exchange from an oToken address
     * @param oToken is the oToken address
     */
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

    /**
     * @notice Function to determine how much of the strike asset we can receive when exercising oTokens.
     * @param oToken is the oToken instance
     * @param exerciseAmount is the amount of oTokens to exercise
     */
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

    /**
     * @notice Function to get the amount of collateral that would be sold to swap from underlying to collateral via Uniswap v2.
     * @param oToken is the oToken instance
     * @param exerciseAmount is the amount of oTokens to exercise
     */
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

    /**
     * @notice Function to convert the standardized purchase amounts (in Wads, 10**18) to an oToken amount (either 10**6 for calls and 10**7 for puts)
     * @param oToken is the oToken address
     * @param purchaseAmount is the purchase amount in Wads
     */
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

    /**
     * @notice Function to lookup the option type of the oToken. Currently oToken contracts don't expose this information. However, we can assume that contracts with the .underlying() as USDC is a call option.
     * @param oTokenUnderlying is underlying asset for an oToken contract
     */
    function getOptionType(address oTokenUnderlying)
        private
        pure
        returns (OptionType)
    {
        return
            oTokenUnderlying == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
                ? OptionType.Call
                : OptionType.Put;
    }
}
