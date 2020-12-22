// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {
    IOToken,
    IOptionsExchange,
    IUniswapFactory,
    UniswapExchangeInterface,
    CompoundOracleInterface
} from "../interfaces/OpynV1Interface.sol";
import {IProtocolAdapter, OptionType} from "./IProtocolAdapter.sol";
import {BaseProtocolAdapter} from "./BaseProtocolAdapter.sol";
import {
    ILendingPool,
    ILendingPoolAddressesProvider
} from "../lib/aave/Interfaces.sol";
import {OpynV1FlashLoaner} from "./OpynV1FlashLoaner.sol";
import "../tests/DebugLib.sol";

contract OpynV1AdapterStorageV1 is BaseProtocolAdapter {
    mapping(bytes => address) public optionTermsToOToken;
}

contract OpynV1Adapter is
    IProtocolAdapter,
    ReentrancyGuard,
    OpynV1FlashLoaner,
    OpynV1AdapterStorageV1,
    DebugLib
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    string private constant _name = "OPYN_V1";
    bool private constant _nonFungible = false;
    uint256 private constant _swapDeadline = 900; // 15 minutes

    struct Number {
        uint256 value;
        int32 exponent;
    }

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
        cost = uniswapExchange.getEthToTokenOutputPrice(
            scaleDownDecimals(IOToken(oToken), purchaseAmount)
        );
    }

    // function exerciseProfit(
    //     address oToken,
    //     uint256 optionID,
    //     uint256 exerciseAmount
    // ) public override view returns (uint256 profit) {
    //     IOToken oTokenContract = IOToken(oToken);

    //     CompoundOracleInterface compoundOracle = CompoundOracleInterface(
    //         oTokenContract.COMPOUND_ORACLE()
    //     );
    //     uint256 strikeAssetPrice = compoundOracle.getPrice(
    //         oTokenContract.strike()
    //     );
    //     address underlying = oTokenContract.underlying();
    //     uint256 underlyingPrice = compoundOracle.getPrice(
    //         underlying == _weth ? address(0) : underlying
    //     );
    //     uint256 strikePriceInUnderlying = wdiv(
    //         strikeAssetPrice,
    //         underlyingPrice
    //     );

    //     (uint256 strikePriceNum, int32 strikePriceExp) = oTokenContract
    //         .strikePrice();
    //     uint256 strikePriceWAD = strikePriceNum *
    //         (10**uint256(18 - strikePriceExp));

    //     bool isProfitable = strikePriceInUnderlying >= strikePriceWAD;

    //     if (isProfitable) {
    //         // TBD about returning profit in underlying or ETH
    //         profit = sub(
    //             wmul(strikePriceInUnderlying, exerciseAmount),
    //             wmul(strikePriceWAD, exerciseAmount)
    //         );
    //     } else {
    //         profit = 0;
    //     }
    // }

    function exerciseProfit(
        address oToken,
        uint256 optionID,
        uint256 exerciseAmount
    ) public override view returns (uint256 profit) {
        IOToken oTokenContract = IOToken(oToken);
        return calculateCollateralToPay(oTokenContract, exerciseAmount);
    }

    function calculateCollateralToPay(IOToken oTokenContract, uint256 oTokens)
        internal
        view
        returns (uint256 collateralToPay)
    {
        CompoundOracleInterface compoundOracle = CompoundOracleInterface(
            oTokenContract.COMPOUND_ORACLE()
        );
        (uint256 strikePriceNum, int32 strikePriceExp) = oTokenContract
            .strikePrice();
        Number memory strikePriceNumber = Number(
            strikePriceNum,
            strikePriceExp
        );

        // Get price from oracle
        uint256 collateralToEthPrice = 1;
        uint256 strikeToEthPrice = 1;
        address collateral = oTokenContract.collateral();
        address strike = oTokenContract.strike();

        if (collateral != strike) {
            collateralToEthPrice = compoundOracle.getPrice(collateral);
            strikeToEthPrice = compoundOracle.getPrice(strike);
        }

        collateralToPay = getAmtCollateralToPay(
            oTokens,
            strikeToEthPrice,
            collateralToEthPrice,
            oTokenContract.collateralExp(),
            strikePriceNumber
        );
    }

    function getAmtCollateralToPay(
        uint256 oTokens,
        uint256 strikeToEthPrice,
        uint256 collateralToEthPrice,
        int32 collateralExp,
        Number memory strikePrice
    ) private pure returns (uint256 amtCollateralToPay) {
        Number memory proportion = Number(1, 0);
        // calculate how much should be paid out
        uint256 amtCollateralToPayInEthNum = oTokens
            .mul(strikePrice.value)
            .mul(proportion.value)
            .mul(strikeToEthPrice);
        int32 amtCollateralToPayExp = strikePrice.exponent +
            proportion.exponent -
            collateralExp;

        amtCollateralToPay = 0;
        uint256 exp;
        if (amtCollateralToPayExp > 0) {
            exp = uint256(amtCollateralToPayExp);
            amtCollateralToPay = amtCollateralToPayInEthNum.mul(10**exp).div(
                collateralToEthPrice
            );
        } else {
            exp = uint256(-1 * amtCollateralToPayExp);
            amtCollateralToPay = amtCollateralToPayInEthNum.div(10**exp).div(
                collateralToEthPrice
            );
        }
        require(exp <= 77, "Options Contract: Exponentiation overflowed");
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

        uint256 scaledAmount = swapForOToken(oToken, cost, amount);

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
    ) private returns (uint256 scaledAmount) {
        scaledAmount = scaleDownDecimals(IOToken(oToken), purchaseAmount);

        uint256 ethSold = getUniswapExchangeFromOToken(oToken)
            .ethToTokenSwapOutput{value: tokenCost}(
            scaledAmount,
            block.timestamp + _swapDeadline
        );

        (bool changeSuccess, ) = msg.sender.call{value: msg.value - ethSold}(
            ""
        );
        require(changeSuccess, "Transfer of change failed");

        // Forward the tokens to the msg.sender
        IERC20(oToken).safeTransfer(msg.sender, scaledAmount);
    }

    function exercise(
        address oToken,
        uint256 optionID,
        uint256 amount
    ) external override payable onlyInstrument nonReentrant {
        uint256 scaledAmount = scaleDownDecimals(IOToken(oToken), amount);
        IERC20(oToken).safeTransferFrom(
            msg.sender,
            address(this),
            scaledAmount
        );
        OpynV1FlashLoaner.exerciseOTokens(oToken, scaledAmount);
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
}
