// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

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
    IERC20 public immutable wbtcToken;
    uint256 public constant deadlineBuffer = 150;

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
        wbtcToken = IERC20(_wbtcAddress);
        
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
        Exchange exchange = validateExchange(exchangeName);
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
        address[] memory path = new address[](2);
        path[0] = wethAddress;
        path[1] = wbtcAddress;
        uint256 wbtcOut = router.getAmountsOut(ethAmt, path)[1];
        return wbtcOut;
    }

    //this function returns both the expected digg amount out as well as the input trade amt of wbtc used
    //these are both needed as inputs to buyLp
    function expectedDiggOut(uint256 wbtcAmt, string memory exchangeName) public view returns (uint256 diggOut, uint256 tradeAmt){
        Exchange exchange = validateExchange(exchangeName);
        if (exchange == Exchange.Uniswap){
                (uint112 reserveAmt,,) = IUniswapV2Pair(wbtcDiggUniswap).getReserves();
                uint256 tradeAmt = getSwapAmt(reserveAmt,wbtcAmt);
                address[] memory path = new address[](2);
                path[0] = wbtcAddress;
                path[1] = diggAddress;
                uint256 diggOut = uniswapRouter.getAmountsOut(tradeAmt, path)[1];
                return (diggOut, tradeAmt);
        }
        else if (exchange == Exchange.Sushiswap){
                (uint112 reserveAmt,,) = IUniswapV2Pair(wbtcDiggSushiswap).getReserves();
                uint256 tradeAmt = getSwapAmt(reserveAmt,wbtcAmt);
                address[] memory path = new address[](2);
                path[0] = wbtcAddress;
                path[1] = diggAddress;
                uint256 diggOut = uniswapRouter.getAmountsOut(tradeAmt, path)[1];
                return (diggOut, tradeAmt);
        }
    }

    function convertEthToToken( uint256 inputAmount, address addr,uint256 amountOutMin, Exchange exchange) internal returns (uint256){
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
        uint256 amtOut = _convertEthToToken(inputAmount, addr, amountOutMin, router);
        return amtOut;
    }

    function convertTokenToToken(address addr1, address addr2, uint256 amount, uint256 amountOutMin, Exchange exchange) internal returns (uint256){
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
        uint256 amtOut = _convertTokenToToken(addr1, addr2, amount, amountOutMin, router);
        return amtOut;
    }

    function addLiquidity(address token1,address token2,uint256 amount1,uint256 amount2,Exchange exchange) internal returns (uint256){
        IUniswapV2Router02 router = exchange == Exchange.Uniswap ? uniswapRouter : sushiswapRouter;
        uint256 lpAmt = _addLiquidity(token1, token2, amount1, amount2, router);
        return lpAmt;
    }

    function _convertEthToToken( uint256 inputAmount, address addr, uint256 amountOutMin,IUniswapV2Router02 router) internal returns (uint256){
        uint deadline = block.timestamp + deadlineBuffer;
        address[] memory path = new address[](2);
        path[0] = wethAddress;
        path[1] = addr;
        uint256 amtOut = router.swapExactETHForTokens{value: inputAmount }(amountOutMin, path, address(this), deadline)[1];
        return amtOut;
    }


    function _convertTokenToToken(address addr1, address addr2, uint256 amount, uint256 amountOutMin, IUniswapV2Router02 router) internal returns(uint256){
        uint deadline = block.timestamp + deadlineBuffer;
        address[] memory path = new address[](2);
        path[0] = addr1;
        path[1] = addr2;
        uint256 amtOut = router.swapExactTokensForTokens(amount,amountOutMin, path, address(this), deadline)[1];
        return amtOut;
    }

    function _addLiquidity(address token1,address token2,uint256 amount1,uint256 amount2, IUniswapV2Router02 router) internal returns (uint256){
        uint deadline = block.timestamp + deadlineBuffer;
        (,, uint256 lpAmt) = router.addLiquidity(token1,token2, amount1, amount2, 0, 0, address(this), deadline);
        return lpAmt;
    }

    //By the time this function is called the user bal should be in wbtc
    //calculates optimal swap amt for minimal leftover funds and buys Digg
    // Provides liquidity and transfers lp token to msg.sender
    function _buyLp( uint256 userWbtcBal, Exchange exchange, address traderAccount, uint256 tradeAmt, uint256 minDiggAmtOut)  internal{
        if (exchange == Exchange.Uniswap){
                uint256 diggAmt = convertTokenToToken(wbtcAddress, diggAddress, tradeAmt, minDiggAmtOut, exchange);
                uint256 lpAmt = addLiquidity(wbtcAddress, diggAddress, userWbtcBal, diggAmt, exchange);
                wbtcDiggUniswap.transfer(traderAccount, lpAmt);
        }
        else if (exchange == Exchange.Sushiswap){
                uint256 diggAmt = convertTokenToToken(wbtcAddress, diggAddress, tradeAmt, minDiggAmtOut, exchange);
                uint256 lpAmt = addLiquidity(wbtcAddress, diggAddress, userWbtcBal, diggAmt, exchange);
                wbtcDiggSushiswap.transfer(traderAccount, lpAmt);
        }
    }

    // token input should be either wbtc or eth
    // valid exchange venues are sushiswap and uniswap
    // the minWbtcAmtOut param isnt used when users pass in wbtc directly
    // use the  expectedWbtcAmtOut and expectedDiggAmtOut functions off chain to calculate trade_amt, minWbtcAmtOut and minDiggAmtOut
    function buyLp(address tokenInput, uint256 amt, string memory exchangeName, uint256 tradeAmt, uint256 minWbtcAmtOut, uint256 minDiggAmtOut) payable public{
        Exchange exchange = validateExchange(exchangeName);
        if (tokenInput == ethAddress){
                require(msg.value >= amt, 'not enough funds');
                uint256 wbtcAmt = convertEthToToken( amt, wbtcAddress, minWbtcAmtOut, exchange);
                _buyLp( wbtcAmt, exchange, msg.sender, tradeAmt, minDiggAmtOut);
        }
        else if (tokenInput == wbtcAddress){
                require(wbtcToken.balanceOf(msg.sender) >= amt, 'not enough funds');
                wbtcToken.transferFrom(msg.sender, address(this), amt);
                _buyLp( amt, exchange, msg.sender,tradeAmt, minDiggAmtOut);
       }
    }
}
