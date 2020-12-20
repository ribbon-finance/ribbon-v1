// SPDX-License-Identifier: MIT
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
import {IUniswapV2Factory} from "../interfaces/IUniswapV2Factory.sol";
import {IWETH} from "../interfaces/IWETH.sol";

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
        exercisePostLoan(underlying, oToken, exerciseAmount, underlyingAmount);

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

    function exercisePostLoan(
        address underlying,
        address oToken,
        uint256 exerciseAmount,
        uint256 underlyingAmount
    ) private {
        IOToken oTokenContract = IOToken(oToken);
        IERC20 underlyingToken = IERC20(underlying);

        require(
            underlyingToken.balanceOf(address(this)) >= underlyingAmount,
            "Not enough underlying to approve"
        );
        underlyingToken.safeApprove(oToken, underlyingAmount);

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
        address weth = _weth;

        if (collateral == address(0)) {
            address[] memory path = new address[](2);
            path[0] = weth;
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
            address[] memory path;
            uint256 pathLength;

            if (collateral == weth || underlying == weth) {
                pathLength = 2;
                path = new address[](pathLength);
                path[0] = collateral;
                path[1] = underlying;
            } else {
                pathLength = 3;
                path = new address[](pathLength);
                path[0] = collateral;
                path[1] = weth;
                path[2] = underlying;
            }
            IERC20 collateralToken = IERC20(collateral);
            uint256[] memory amountsIn = router.getAmountsIn(
                underlyingAmount,
                path
            );
            soldCollateralAmount = amountsIn[0];

            IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
            address uniswapPair = factory.getPair(path[0], path[1]);

            require(
                collateralToken.balanceOf(address(this)) >=
                    soldCollateralAmount,
                "Not enough collateral to swap"
            );
            collateralToken.safeApprove(address(router), soldCollateralAmount);

            uint256[] memory amountsOut = router.swapTokensForExactTokens(
                underlyingAmount,
                soldCollateralAmount,
                path,
                address(this),
                block.timestamp + _swapWindow
            );
            boughtUnderlyingAmount = amountsOut[pathLength - 1];
        }
    }

    function returnExercisedProfit(
        IOToken oToken,
        address underlying,
        address collateral,
        uint256 exerciseAmount,
        uint256 soldAmount,
        address sender
    ) private {
        if (collateral == address(0)) {
            uint256 settledProfit = address(this).balance;
            (bool returnExercise, ) = sender.call{value: settledProfit}("");
            require(returnExercise, "Transfer exercised profit failed");
        } else if (collateral == _weth) {
            uint256 balance = address(this).balance;
            IWETH wethContract = IWETH(_weth);
            wethContract.withdraw(balance);
            (bool returnExercise, ) = sender.call{value: balance}("");
            require(returnExercise, "Transfer exercised profit failed");
        } else {
            IUniswapV2Router02 router = IUniswapV2Router02(_uniswapRouter);
            IERC20 collateralToken = IERC20(collateral);
            uint256 collateralBalance = collateralToken.balanceOf(
                address(this)
            );
            address[] memory path = new address[](2);
            path[0] = collateral;
            path[1] = _weth;
            uint256[] memory amountsOut = router.getAmountsOut(
                collateralBalance,
                path
            );

            collateralToken.approve(address(router), collateralBalance);

            router.swapExactTokensForETH(
                collateralBalance,
                amountsOut[1],
                path,
                sender,
                block.timestamp + _swapWindow
            );
        }
    }

    function toAsciiString(address x) private returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint256 i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint256(x) / (2**(8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 * i] = char(hi);
            s[2 * i + 1] = char(lo);
        }
        return string(s);
    }

    function char(bytes1 b) private returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
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
}
