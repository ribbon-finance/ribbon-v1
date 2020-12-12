// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

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

contract OpynV1AdapterStorageV1 is BaseProtocolAdapter {
    mapping(bytes => address) public optionTermsToOToken;

    uint256 public maxSlippage;
}

contract OpynV1Adapter is
    IProtocolAdapter,
    ReentrancyGuard,
    OpynV1FlashLoaner,
    OpynV1AdapterStorageV1
{
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
        address weth,
        uint256 _maxSlippage
    ) public initializer {
        owner = _owner;
        dojiFactory = _dojiFactory;
        _addressesProvider = _provider;
        _lendingPool = ILendingPool(
            ILendingPoolAddressesProvider(_provider).getLendingPool()
        );
        _uniswapRouter = router;
        _weth = weth;
        maxSlippage = _maxSlippage;
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
            normalizeDecimals(IOToken(oToken), purchaseAmount)
        );
    }

    function exerciseProfit(
        address oToken,
        uint256 optionID,
        uint256 exerciseAmount
    ) public override view returns (uint256 profit) {
        IOToken oTokenContract = IOToken(oToken);

        CompoundOracleInterface compoundOracle = CompoundOracleInterface(
            oTokenContract.COMPOUND_ORACLE()
        );
        uint256 strikeAssetPrice = compoundOracle.getPrice(
            oTokenContract.strike()
        );
        uint256 underlyingPrice = compoundOracle.getPrice(
            oTokenContract.underlying()
        );
        uint256 strikePriceInUnderlying = wdiv(
            strikeAssetPrice,
            underlyingPrice
        );

        (uint256 strikePriceNum, int32 strikePriceExp) = oTokenContract
            .strikePrice();
        uint256 strikePriceWAD = strikePriceNum *
            (10**uint256(18 - strikePriceExp));

        bool isProfitable = strikePriceInUnderlying >= strikePriceWAD;

        if (isProfitable) {
            // TBD about returning profit in underlying or ETH
            profit = sub(
                wmul(strikePriceInUnderlying, exerciseAmount),
                wmul(strikePriceWAD, exerciseAmount)
            );
        } else {
            profit = 0;
        }
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
        require(msg.value >= cost, "Value doest not cover cost");

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
        scaledAmount = normalizeDecimals(IOToken(oToken), purchaseAmount);

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
        uint256 scaledAmount = normalizeDecimals(IOToken(oToken), amount);
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

        address underlying;
        address strikeAsset;

        if (optionType == OptionType.Call) {
            underlying = oTokenContract.collateral();
            strikeAsset = oTokenContract.underlying();
        } else if (optionType == OptionType.Put) {
            underlying = oTokenContract.underlying();
            strikeAsset = oTokenContract.collateral();
        }
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

    function setMaxSlippage(uint256 _maxSlippage) public onlyOwner {
        maxSlippage = _maxSlippage;
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

    function normalizeDecimals(IOToken oToken, uint256 amount)
        private
        view
        returns (uint256 normalized)
    {
        uint256 decimals = oToken.decimals();
        normalized = amount / 10**(18 - decimals);
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
