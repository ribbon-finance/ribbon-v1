// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import {OtokenInterface, IController} from "../interfaces/GammaInterface.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {DSMath} from "../lib/DSMath.sol";

contract MockGammaController is DSMath {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public price;
    address public oracle;
    IUniswapV2Router02 public router;
    address public weth;

    constructor(
        address _oracle,
        IUniswapV2Router02 _router,
        address _weth
    ) {
        oracle = _oracle;
        router = _router;
        weth = _weth;
    }

    function getPayout(address _otoken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        OtokenInterface oToken = OtokenInterface(_otoken);
        uint256 strikePrice = oToken.strikePrice();

        uint256 payout;
        if (strikePrice >= price) {
            payout = _amount;
        } else {
            payout = (price.sub(strikePrice)).mul(_amount).div(10**8);
        }

        uint256 collateralDecimals;
        if (
            oToken.collateralAsset() ==
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        ) {
            collateralDecimals = 6;
            return (payout.mul(10**collateralDecimals)).div(10**8);
        } else {
            collateralDecimals = 18;
            return wdiv(payout, price);
        }
    }

    function operate(IController.ActionArgs[] memory actions) public {
        for (uint256 i = 0; i < actions.length; i++) {
            IController.ActionArgs memory action = actions[i];
            if (action.actionType == IController.ActionType.Redeem) {
                _redeem(_parseRedeemArgs(action));
            }
        }
    }

    function buyCollateral(address otoken) external payable {
        address collateralAsset = OtokenInterface(otoken).collateralAsset();

        if (collateralAsset == weth) {
            IWETH wethContract = IWETH(weth);
            wethContract.deposit{value: msg.value}();
            return;
        }

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = collateralAsset;

        uint256[] memory amountsOut = router.getAmountsOut(msg.value, path);
        uint256 minAmountOut = amountsOut[1];

        router.swapExactETHForTokens{value: msg.value}(
            minAmountOut,
            path,
            address(this),
            block.timestamp + 1000
        );

        require(
            IERC20(collateralAsset).balanceOf(address(this)) >= minAmountOut,
            "Not enough collateral balance"
        );
    }

    function _redeem(IController.RedeemArgs memory _args) internal {
        OtokenInterface otoken = OtokenInterface(_args.otoken);

        require(
            block.timestamp >= otoken.expiryTimestamp(),
            "Controller: can not redeem un-expired otoken"
        );

        uint256 payout = getPayout(_args.otoken, _args.amount);

        IERC20 collateralToken = IERC20(otoken.collateralAsset());

        require(
            collateralToken.balanceOf(address(this)) >= payout,
            "Not enough collateral balance to payout"
        );

        collateralToken.safeTransfer(_args.receiver, payout);
    }

    function _parseRedeemArgs(IController.ActionArgs memory _args)
        internal
        pure
        returns (IController.RedeemArgs memory)
    {
        require(
            _args.actionType == IController.ActionType.Redeem,
            "Actions: can only parse arguments for redeem actions"
        );
        require(
            _args.secondAddress != address(0),
            "Actions: cannot redeem to an invalid account"
        );

        return
            IController.RedeemArgs({
                receiver: _args.secondAddress,
                otoken: _args.asset,
                amount: _args.amount
            });
    }

    function setPrice(uint256 amount) public {
        price = amount;
    }
}
