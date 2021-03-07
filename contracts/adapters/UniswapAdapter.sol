// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {
    IUniswapV2Pair,
    IUniswapV2Router01
} from "../interfaces/UniswapInterface.sol";

contract UniswapAdapter is Ownable{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable ethAddress;
    address public immutable diggAddress;
    address public constant wethAddress = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    string private constant _name = "UNISWAP";
    string private constant _uniswapExchange = "UNISWAP";
    string private constant _sushiswapExchange = "SUSHISWAP";
    string[2] private venues = [_uniswapExchange, _sushiswapExchange];
    address public immutable wbtcAddress;
    bool private constant _nonFungible = true;
    IUniswapV2Router01 public immutable uniswapRouter;
    IUniswapV2Router01 public immutable sushiswapRouter;
    IUniswapV2Pair public immutable wbtcDiggUniswap;
    IUniswapV2Pair public immutable wbtcDiggSushiswap;
    uint256 slippageDivisor = 500;


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
        uniswapRouter = IUniswapV2Router01(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router01(_sushiswapRouter);
        wbtcDiggUniswap = IUniswapV2Pair(_wbtcDiggUniswap);
        wbtcDiggSushiswap = IUniswapV2Pair(_wbtcDiggSushiswap);

    }

   receive() external payable {}


   function modifySlippage(uint256 newSlippageDivisor) onlyOwner public {
        slippageDivisor = newSlippageDivisor;

    }

    function getSlippageDivisor() public view returns (uint256) {
        return slippageDivisor;
    }

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

    // The core math involved in getting optimal swap amt to provide amm liquidity
    function getSwapAmt(uint256 amtA, uint256 resA) internal pure returns (uint256){
        return sqrt(amtA.mul(resA.mul(3988000) + amtA.mul(3988009))).sub(amtA.mul(1997))/1994;
    }

    function validateExchange(string memory exchangeName) internal view returns (bool){
        for (uint i = 0; i < 2; i++){
                if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(venues[i]))){
                        return true;
                }
        }
        return false;
    }

    function convertEthToToken( uint256 inputAmount, address addr, string memory exchangeName) internal {
        if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_uniswapExchange))){
                _convertEthToToken(inputAmount, addr, uniswapRouter);
        }
        else if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_sushiswapExchange))){
                _convertEthToToken(inputAmount, addr, sushiswapRouter);
        }
    }

   function convertTokenToToken(address addr1, address addr2, uint256 amount, string memory exchangeName) internal {
        if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_uniswapExchange))){
                _convertTokenToToken(addr1, addr2, amount, uniswapRouter);
        }
        else if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_sushiswapExchange))){
                _convertTokenToToken(addr1, addr2, amount, sushiswapRouter);
        }
   }

   function addLiquidity(address token1,address token2,uint256 amount1,uint256 amount2,string memory exchangeName) internal {
        if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_uniswapExchange))){
                _addLiquidity(token1, token2, amount1, amount2, uniswapRouter);
         }

         else if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_sushiswapExchange))){
                _addLiquidity(token1, token2, amount1, amount2, sushiswapRouter);
         }

      }

   function _convertEthToToken( uint256 inputAmount, address addr, IUniswapV2Router01 router) internal {
        uint deadline = block.timestamp + 150;
        address[] memory path = new address[](2);
        path[0] = wethAddress;
        path[1] = addr;
        uint256 expectedOutput = router.getAmountsOut(inputAmount, path)[1];

        uint256 slippage = expectedOutput/slippageDivisor;
        uint256 amountOutMin = expectedOutput - slippage;

        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: inputAmount }(amountOutMin, path, address(this), deadline);
    }


    function _convertTokenToToken(address addr1, address addr2, uint256 amount,IUniswapV2Router01 router) internal {
        uint deadline = block.timestamp + 150;
        IERC20 tokenIn = IERC20(addr1);
        address[] memory path = new address[](2);
        path[0] = addr1;
        path[1] = addr2;
        if (tokenIn.allowance(address(this), address(router)) == 0){
                SafeERC20.safeApprove(tokenIn, address(router), 115792089237316195423570985008687907853269984665640564039457584007913129639935);
        }
        uint256 expectedOutput = router.getAmountsOut(amount, path)[1];

        uint256 slippage = expectedOutput/slippageDivisor;
        uint256 amountOutMin = expectedOutput - slippage;
        router.swapExactTokensForTokens(amount,amountOutMin, path, address(this), deadline);

    }

      function _addLiquidity(address token1,address token2,uint256 amount1,uint256 amount2, IUniswapV2Router01 router) internal {
        uint deadline = block.timestamp + 150;


        IERC20 toAdd = IERC20(token1);
        IERC20 toAdd2 = IERC20(token2);
        if (toAdd.allowance(address(this), address(router)) < amount1){
                        SafeERC20.safeApprove(toAdd, address(router), 115792089237316195423570985008687907853269984665640564039457584007913129639935);
                }
        if (toAdd2.allowance(address(this), address(router)) < amount2){
                        SafeERC20.safeApprove(toAdd2, address(router), 115792089237316195423570985008687907853269984665640564039457584007913129639935);
                }

        router.addLiquidity(token1,token2, amount1, amount2, 0, 0, address(this), deadline);
    }

     //By the time this function is called the user bal should be in wbtc
     //calculates optimal swap amt for minimal leftover funds and buys Digg
     // Provides liquidity and transfers lp token to msg.sender
     function _buyLp( uint256 userWbtcBal, string memory exchangeName, address traderAccount)  internal{


          if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_uniswapExchange))){
                (uint112 reserve_amt,,) = IUniswapV2Pair(wbtcDiggUniswap).getReserves();
                uint256 trade_amt = getSwapAmt(reserve_amt,userWbtcBal);
                uint256 startingDiggBal = IERC20(diggAddress).balanceOf(address(this));
                convertTokenToToken(wbtcAddress, diggAddress, trade_amt, exchangeName);
                uint256 startLpBal = wbtcDiggUniswap.balanceOf(address(this));
                addLiquidity(wbtcAddress, diggAddress, userWbtcBal, IERC20(diggAddress).balanceOf(address(this)) - startingDiggBal, exchangeName);

                wbtcDiggUniswap.transfer(traderAccount, wbtcDiggUniswap.balanceOf(address(this)) - startLpBal);

          }
          else if (keccak256(abi.encodePacked(exchangeName)) == keccak256(abi.encodePacked(_sushiswapExchange))){
                (uint112 reserve_amt,,) = IUniswapV2Pair(wbtcDiggSushiswap).getReserves();
                uint256 trade_amt = getSwapAmt(reserve_amt,userWbtcBal);
                uint256 startingDiggBal = IERC20(diggAddress).balanceOf(address(this));
                convertTokenToToken(wbtcAddress, diggAddress, trade_amt, exchangeName);
                uint256 startLpBal = wbtcDiggSushiswap.balanceOf(address(this));
                addLiquidity(wbtcAddress, diggAddress, userWbtcBal, IERC20(diggAddress).balanceOf(address(this)) - startingDiggBal, exchangeName);

                wbtcDiggSushiswap.transfer(traderAccount, wbtcDiggSushiswap.balanceOf(address(this)) - startLpBal);

          }
     }

      // token input should be either wbtc or eth
      // valid exchange venues are sushiswap and uniswap
      function buyLp(address tokenInput, uint256 amt, string memory exchangeName) payable public{
        require(validateExchange(exchangeName) == true, 'invalid exchange');
        if (tokenInput == ethAddress){
                require(msg.value >= amt, 'not enough funds');
                IERC20 wbtcToken =  IERC20(wbtcAddress);
                uint256 startingWbtcBal = wbtcToken.balanceOf(address(this));
                convertEthToToken( amt, wbtcAddress, exchangeName);
                uint256 afterWbtcBal = wbtcToken.balanceOf(address(this));
                _buyLp( afterWbtcBal - startingWbtcBal, exchangeName, msg.sender);

        }

        else if (tokenInput == wbtcAddress){

                IERC20 wbtcToken =  IERC20(wbtcAddress);
                uint256 startingWbtcBal = wbtcToken.balanceOf(address(this));

                wbtcToken.transferFrom(msg.sender, address(this), amt);
                uint256 afterWbtcBal = wbtcToken.balanceOf(address(this));
                _buyLp( afterWbtcBal - startingWbtcBal, exchangeName, msg.sender);
        }

       }


}