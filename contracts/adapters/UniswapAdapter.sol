// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {IUniswapV2Pair} from "../interfaces/IUniswapV2Pair.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";

contract UniswapAdapter {

    enum Exchange {Uniswap, Sushiswap}

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable ethAddress;
    address public immutable diggAddress;
    address public constant wethAddress = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    string private constant _name = "UNISWAP";
    bytes32 private constant uniswapHash = keccak256(abi.encodePacked("UNISWAP"));
    bytes32 private constant sushiswapHash = keccak256(abi.encodePacked("SUSHISWAP"));
    address public immutable wbtcAddress;
    bool private constant _nonFungible = true;
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Router02 public immutable sushiswapRouter;
    IUniswapV2Pair public immutable wbtcDiggUniswap;
    IUniswapV2Pair public immutable wbtcDiggSushiswap;
    uint256 deadlineBuffer = 150;

    constructor(
        address _uniswapRouter,
        address _sushiswapRouter,
        address _wbtcAddress,
        address _ethAddress,
        address _wbtcDiggUniswap,
        address _wbtcDiggSushiswap,
        address _diggAddress
    ) public {

        wbtcAddress = _wbtcAddress;
        ethAddress = _ethAddress;
        diggAddress = _diggAddress;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
        wbtcDiggUniswap = IUniswapV2Pair(_wbtcDiggUniswap);
        wbtcDiggSushiswap = IUniswapV2Pair(_wbtcDiggSushiswap);

     }

    receive() external payable {}

    function protocolName() public pure returns (string memory) {
        return _name;
    }

    function nonFungible() external pure  returns (bool) {
        return _nonFungible;
    }


    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    // Code from Alpha Homora
    // The core math involved in getting optimal swap amt to provide amm liquidity
    function getSwapAmt(uint256 amtA, uint256 resA) internal pure returns (uint256){
        return sqrt(amtA.mul(resA.mul(3988000) + amtA.mul(3988009))).sub(amtA.mul(1997))/1994;
    }

    function validateExchange(string memory exchangeName) internal view returns (Exchange){
        if (keccak256(abi.encodePacked(exchangeName)) == uniswapHash){
                return Exchange.Uniswap;
        }
        else if (keccak256(abi.encodePacked(exchangeName)) == sushiswapHash){
                return Exchange.Sushiswap;
        }
       require(false, 'invalid exchange');
    }

    function expectedWbtcOut(uint256 ethAmt, string memory exchangeName) public view returns (uint256){
        if (keccak256(abi.encodePacked(exchangeName)) == uniswapHash){
                address[] memory path = new address[](2);
                path[0] = wethAddress;
                path[1] = wbtcAddress;
                uint256 wbtcOut = uniswapRouter.getAmountsOut(ethAmt, path)[1];
                return wbtcOut;
        }
        if (keccak256(abi.encodePacked(exchangeName)) == sushiswapHash){
                address[] memory path = new address[](2);
                path[0] = wethAddress;
                path[1] = wbtcAddress;
                uint256 wbtcOut = sushiswapRouter.getAmountsOut(ethAmt, path)[1];
                return wbtcOut;
        }
    }

    function expectedDiggOut(uint256 wbtcAmt, string memory exchangeName) public view returns (uint256){
        if (keccak256(abi.encodePacked(exchangeName)) == uniswapHash){
                (uint112 reserve_amt,,) = IUniswapV2Pair(wbtcDiggUniswap).getReserves();
                uint256 trade_amt = getSwapAmt(reserve_amt,wbtcAmt);
                address[] memory path = new address[](2);
                path[0] = wbtcAddress;
                path[1] = diggAddress;
                uint256 diggOut = uniswapRouter.getAmountsOut(trade_amt, path)[1];
                return diggOut;
        }
        else if (keccak256(abi.encodePacked(exchangeName)) == sushiswapHash){
                (uint112 reserve_amt,,) = IUniswapV2Pair(wbtcDiggSushiswap).getReserves();
                uint256 trade_amt = getSwapAmt(reserve_amt,wbtcAmt);
                address[] memory path = new address[](2);
                path[0] = wbtcAddress;
                path[1] = diggAddress;
                uint256 diggOut = uniswapRouter.getAmountsOut(trade_amt, path)[1];
                return diggOut;
        }
    }

    function convertEthToToken( uint256 inputAmount, address addr,uint256 amountOutMin, Exchange exchange) internal {
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
        _convertEthToToken(inputAmount, addr, amountOutMin, router);
    }

    function convertTokenToToken(address addr1, address addr2, uint256 amount, uint256 amountOutMin, Exchange exchange) internal {
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
        _convertTokenToToken(addr1, addr2, amount, amountOutMin, router);
    }

    function addLiquidity(address token1,address token2,uint256 amount1,uint256 amount2,Exchange exchange) internal {
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
                _addLiquidity(token1, token2, amount1, amount2, router);
    }

    function _convertEthToToken( uint256 inputAmount, address addr, uint256 amountOutMin,IUniswapV2Router02 router) internal {
        uint deadline = block.timestamp + deadlineBuffer;
        address[] memory path = new address[](2);
        path[0] = wethAddress;
        path[1] = addr;
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: inputAmount }(amountOutMin, path, address(this), deadline);
    }


    function _convertTokenToToken(address addr1, address addr2, uint256 amount, uint256 amountOutMin, IUniswapV2Router02 router) internal {
        uint deadline = block.timestamp + deadlineBuffer;
        IERC20 tokenIn = IERC20(addr1);
        address[] memory path = new address[](2);
        path[0] = addr1;
        path[1] = addr2;
        if (tokenIn.allowance(address(this), address(router)) == 0){
                SafeERC20.safeApprove(tokenIn, address(router), type(uint256).max);
        }

        router.swapExactTokensForTokens(amount,amountOutMin, path, address(this), deadline);

    }

    function _addLiquidity(address token1,address token2,uint256 amount1,uint256 amount2, IUniswapV2Router02 router) internal {
        uint deadline = block.timestamp + deadlineBuffer;
        IERC20 toAdd = IERC20(token1);
        IERC20 toAdd2 = IERC20(token2);
        if (toAdd.allowance(address(this), address(router)) < amount1){
                SafeERC20.safeApprove(toAdd, address(router), type(uint256).max);
        }
        if (toAdd2.allowance(address(this), address(router)) < amount2){
                SafeERC20.safeApprove(toAdd2, address(router), type(uint256).max);
        }

        router.addLiquidity(token1,token2, amount1, amount2, 0, 0, address(this), deadline);
    }

    //By the time this function is called the user bal should be in wbtc
    //calculates optimal swap amt for minimal leftover funds and buys Digg
    // Provides liquidity and transfers lp token to msg.sender
    function _buyLp( uint256 userWbtcBal, Exchange exchange, address traderAccount, uint256 minDiggAmtOut)  internal{

        if (exchange == Exchange.Uniswap){
                (uint112 reserve_amt,,) = IUniswapV2Pair(wbtcDiggUniswap).getReserves();
                uint256 trade_amt = getSwapAmt(reserve_amt,userWbtcBal);
                uint256 startingDiggBal = IERC20(diggAddress).balanceOf(address(this));
                convertTokenToToken(wbtcAddress, diggAddress, trade_amt, minDiggAmtOut, exchange);
                uint256 startLpBal = wbtcDiggUniswap.balanceOf(address(this));
                addLiquidity(wbtcAddress, diggAddress, userWbtcBal, IERC20(diggAddress).balanceOf(address(this)).sub(startingDiggBal), exchange);
                wbtcDiggUniswap.transfer(traderAccount, wbtcDiggUniswap.balanceOf(address(this)).sub(startLpBal));
        }
        else if (exchange == Exchange.Uniswap){
                (uint112 reserve_amt,,) = IUniswapV2Pair(wbtcDiggSushiswap).getReserves();
                uint256 trade_amt = getSwapAmt(reserve_amt,userWbtcBal);
                uint256 startingDiggBal = IERC20(diggAddress).balanceOf(address(this));
                convertTokenToToken(wbtcAddress, diggAddress, trade_amt, minDiggAmtOut, exchange);
                uint256 startLpBal = wbtcDiggSushiswap.balanceOf(address(this));
                addLiquidity(wbtcAddress, diggAddress, userWbtcBal, IERC20(diggAddress).balanceOf(address(this)).sub(startingDiggBal), exchange);
                wbtcDiggSushiswap.transfer(traderAccount, wbtcDiggSushiswap.balanceOf(address(this)).sub(startLpBal));
        }
    }

    // token input should be either wbtc or eth
    // valid exchange venues are sushiswap and uniswap
    // the minWbtcAmtOut param isnt used when users pass in wbtc directly
    // use the  expectedWbtcAmtOut and expectedDiggAmtOut functions off chain to calculate minWbtcAmtOut and minDiggAmtOut
    function buyLp(address tokenInput, uint256 amt, string memory exchangeName, uint256 minWbtcAmtOut, uint256 minDiggAmtOut) payable public{
        Exchange exchange = validateExchange(exchangeName);

        if (tokenInput == ethAddress){
                require(msg.value >= amt, 'not enough funds');
                IERC20 wbtcToken =  IERC20(wbtcAddress);
                uint256 startingWbtcBal = wbtcToken.balanceOf(address(this));
                convertEthToToken( amt, wbtcAddress, minWbtcAmtOut, exchange);
                uint256 afterWbtcBal = wbtcToken.balanceOf(address(this));
                _buyLp( afterWbtcBal.sub(startingWbtcBal), exchange, msg.sender, minDiggAmtOut);
        }
        else if (tokenInput == wbtcAddress){
                IERC20 wbtcToken =  IERC20(wbtcAddress);
                require(wbtcToken.balanceOf(msg.sender) >= amt, 'not enough funds');
                uint256 startingWbtcBal = wbtcToken.balanceOf(address(this));
                wbtcToken.transferFrom(msg.sender, address(this), amt);
                uint256 afterWbtcBal = wbtcToken.balanceOf(address(this));
                _buyLp( afterWbtcBal.sub(startingWbtcBal), exchange, msg.sender, minDiggAmtOut);
       }
    }
}