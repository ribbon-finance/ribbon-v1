// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0;

import {FlashLoanReceiverBase} from "../lib/aave/FlashLoanReceiverBase.sol";
import {
    ILendingPool,
    ILendingPoolAddressesProvider
} from "../lib/aave/Interfaces.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {DSMath} from "../lib/DSMath.sol";
import {
    ERC20Decimals,
    IOToken,
    IOptionsExchange,
    IUniswapFactory,
    UniswapExchangeInterface,
    CompoundOracleInterface
} from "../interfaces/OpynV1Interface.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";

contract OpynV1FlashLoaner is DSMath, FlashLoanReceiverBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant _vaultStartIteration = 0;
    uint256 private constant _maxVaultIterations = 5;
    uint256 private constant _swapWindow = 900;
    address internal _uniswapRouter;
    address internal _weth;
    mapping(address => address payable[]) internal vaults;

    constructor(ILendingPoolAddressesProvider _addressProvider)
        public
        FlashLoanReceiverBase(_addressProvider)
    {}

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        //
        // This contract now has the funds requested.
        // Your logic goes here.
        //
        // 1. Call underlyingrequiredtoexercise to get usdc amount
        // 2. Approve OptionsContract on underlying token with that amount
        // 3. call exercise
        // 4. Verify that we have received the collateral
        // 5. Swap the fee amount to underlying using the collateral
        // 6. Leftover collateral (collateral - underlying) used as profit

        address underlying = assets[0];
        uint256 underlyingAmount = amounts[0];

        (address oToken, uint256 exerciseAmount, address sender) = abi.decode(
            params,
            (address, uint256, address)
        );
        address collateral = IOToken(oToken).collateral();

        // Get ETH back in return
        exercisePostLoan(underlying, oToken, exerciseAmount);

        // Get 1 Ether

        // Sell ETH for USDC
        (uint256 soldCollateralAmount, ) = swapForUnderlying(
            underlying,
            collateral,
            underlyingAmount + premiums[0]
        );

        returnExercisedProfit(
            IOToken(oToken),
            underlying,
            collateral,
            exerciseAmount,
            soldCollateralAmount,
            sender
        );

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.
        // Approve the LendingPool contract allowance to *pull* the owed amount
        IERC20(underlying).safeApprove(
            address(_lendingPool),
            underlyingAmount + premiums[0]
        );

        return true;
    }

    function returnExercisedProfit(
        IOToken oToken,
        address underlying,
        address collateral,
        uint256 exerciseAmount,
        uint256 soldAmount,
        address sender
    ) private {
        uint256 strikePriceWAD = getStrikePrice(oToken) /
            10**ERC20Decimals(underlying).decimals();
        uint256 cashAmount = wdiv(
            scaleUpDecimals(oToken, exerciseAmount),
            strikePriceWAD
        );

        uint256 settledProfit = sub(cashAmount, soldAmount);
        if (collateral == address(0)) {
            (bool returnExercise, ) = sender.call{value: settledProfit}("");
            require(returnExercise, "Transfer exercised profit failed");
        } else {
            IERC20(collateral).safeTransfer(sender, settledProfit);
        }
    }

    function uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        return string(bstr);
    }

    function exercisePostLoan(
        address underlying,
        address oToken,
        uint256 exerciseAmount
    ) private {
        IOToken oTokenContract = IOToken(oToken);
        IERC20 underlyingToken = IERC20(underlying);

        require(
            underlyingToken.balanceOf(address(this)) >= exerciseAmount,
            "Not enough underlying to approve"
        );
        underlyingToken.safeApprove(oToken, exerciseAmount);

        require(
            IERC20(oToken).balanceOf(address(this)) >= exerciseAmount,
            "Not enough oToken to approve"
        );
        IERC20(oToken).safeApprove(oToken, exerciseAmount);

        address payable[] memory vaultOwners = vaults[oToken];
        oTokenContract.exercise(exerciseAmount, vaultOwners);
    }

    function swapForUnderlying(
        address underlying,
        address collateral,
        uint256 underlyingAmount
    )
        private
        returns (uint256 soldCollateralAmount, uint256 boughtUnderlyingAmount)
    {
        IUniswapV2Router02 router = IUniswapV2Router02(_uniswapRouter);

        if (collateral == address(0)) {
            address[] memory path = new address[](2);
            path[0] = _weth;
            path[1] = underlying;

            uint256[] memory amountsIn = router.getAmountsIn(
                underlyingAmount,
                path
            );
            soldCollateralAmount = amountsIn[0];

            uint256[] memory amounts = router.swapETHForExactTokens{
                value: soldCollateralAmount
            }(
                underlyingAmount,
                path,
                address(this),
                block.timestamp + _swapWindow
            );
            boughtUnderlyingAmount = amounts[1];
        } else {
            address[] memory path = new address[](3);
            path[0] = collateral;
            path[1] = _weth;
            path[2] = underlying;
            IERC20 collateralToken = IERC20(collateral);
            uint256[] memory amountsIn = router.getAmountsIn(
                underlyingAmount,
                path
            );
            soldCollateralAmount = amountsIn[0];

            collateralToken.safeApprove(address(router), soldCollateralAmount);

            uint256[] memory amounts = router.swapTokensForExactTokens(
                underlyingAmount,
                soldCollateralAmount,
                path,
                address(this),
                block.timestamp + _swapWindow
            );
            boughtUnderlyingAmount = amounts[2];
        }
    }

    function exerciseOTokens(address oToken, uint256 exerciseAmount) public {
        address receiverAddress = address(this);

        IOToken oTokenContract = IOToken(oToken);
        uint256 underlyingAmount = oTokenContract.underlyingRequiredToExercise(
            exerciseAmount
        );

        address[] memory assets = new address[](1);
        address underlying = oTokenContract.underlying();
        assets[0] = underlying == address(0) ? _weth : underlying;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = underlyingAmount;

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        address onBehalfOf = address(this);
        bytes memory params = abi.encode(oToken, exerciseAmount, msg.sender);
        uint16 referralCode = 0;

        _lendingPool.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    function scaleUpDecimals(IOToken oToken, uint256 amount)
        internal
        view
        returns (uint256 normalized)
    {
        uint256 decimals = oToken.decimals();
        normalized = amount * 10**(18 - decimals);
    }

    function scaleDownDecimals(IOToken oToken, uint256 amount)
        internal
        view
        returns (uint256 normalized)
    {
        uint256 decimals = oToken.decimals();
        normalized = amount / 10**(18 - decimals);
    }

    function getStrikePrice(IOToken oTokenContract)
        internal
        view
        returns (uint256 strikePrice)
    {
        (uint256 strikePriceNum, int32 strikePriceExp) = oTokenContract
            .strikePrice();

        uint256 strikePriceInStrikeAsset = mul(
            strikePriceNum,
            10**uint256(18 + strikePriceExp)
        );
        CompoundOracleInterface compoundOracle = CompoundOracleInterface(
            oTokenContract.COMPOUND_ORACLE()
        );
        uint256 strikeAssetPrice = compoundOracle.getPrice(
            oTokenContract.strike()
        );
        strikePrice = wdiv(strikeAssetPrice, strikePriceInStrikeAsset);
    }

    // function getVaults(IOToken oTokenContract)
    //     public
    //     view
    //     returns (address payable[] memory vaults)
    // {
    //     vaults = new address payable[](_maxVaultIterations);
    //     uint256 currentVaultIndex = 0;
    //     for (
    //         uint256 v = _vaultStartIteration;
    //         v < _vaultStartIteration + _maxVaultIterations;
    //         v++
    //     ) {
    //         address payable vault = oTokenContract.vaultOwners(v);
    //         if (vault != address(0)) {
    //             vaults[currentVaultIndex] = vault;
    //             currentVaultIndex++;
    //         }
    //     }
    // }
}
