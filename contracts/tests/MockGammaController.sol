// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";
import {OtokenInterface, IController} from "../interfaces/GammaInterface.sol";

contract MockGammaController {
    using SafeMath for uint256;

    uint256 public price;
    address public oracle;
    IUniswapV2Router02 public router;
    address public weth;

    constructor(
        address _oracle,
        IUniswapV2Router02 _router,
        address _weth
    ) public {
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

        if (strikePrice >= price) {
            return _amount;
        }

        uint256 payout = (price.sub(strikePrice)).mul(_amount).div(10**8);
        return (payout.mul(10**6)).div(10**8);
    }

    function operate(IController.ActionArgs[] memory actions) public {
        for (uint256 i = 0; i < actions.length; i++) {
            IController.ActionArgs memory action = actions[i];
            if (action.actionType == IController.ActionType.Redeem) {
                _redeem(_parseRedeemArgs(action));
            }
        }
    }

    function buyCollateral(address otoken, uint256 buyAmount) external payable {
        address collateralAsset = OtokenInterface(otoken).collateralAsset();

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = collateralAsset;

        uint256[] memory amountsIn = router.getAmountsIn(buyAmount, path);
        uint256 sellAmount = amountsIn[0];
        require(msg.value >= sellAmount, "Not enough value");

        router.swapETHForExactTokens{value: sellAmount}(
            buyAmount,
            path,
            address(this),
            block.timestamp + 1000
        );
    }

    function _redeem(IController.RedeemArgs memory _args) internal {
        OtokenInterface otoken = OtokenInterface(_args.otoken);

        require(
            now >= otoken.expiryTimestamp(),
            "Controller: can not redeem un-expired otoken"
        );

        uint256 payout = getPayout(_args.otoken, _args.amount);

        otoken.burnOtoken(msg.sender, _args.amount);

        IERC20(otoken.collateralAsset()).transfer(_args.receiver, payout);
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
