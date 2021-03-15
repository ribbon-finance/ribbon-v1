## `UniswapAdapter`






### `constructor(address _uniswapRouter, address _sushiswapRouter, address _wbtcAddress, address _ethAddress, address _wbtcDiggUniswap, address _wbtcDiggSushiswap, address _diggAddress)` (public)





### `receive()` (external)





### `protocolName() → string` (public)





### `nonFungible() → bool` (external)





### `sqrt(uint256 y) → uint256 z` (internal)





### `getSwapAmt(uint256 amtA, uint256 resA) → uint256` (internal)





### `validateExchange(string exchangeName) → enum UniswapAdapter.Exchange` (internal)





### `expectedWbtcOut(uint256 ethAmt, string exchangeName) → uint256` (public)





### `expectedDiggOut(uint256 wbtcAmt, string exchangeName) → uint256 diggOut, uint256 tradeAmt` (public)





### `convertEthToToken(uint256 inputAmount, address addr, uint256 amountOutMin, enum UniswapAdapter.Exchange exchange) → uint256` (internal)





### `convertTokenToToken(address addr1, address addr2, uint256 amount, uint256 amountOutMin, enum UniswapAdapter.Exchange exchange) → uint256` (internal)





### `addLiquidity(address token1, address token2, uint256 amount1, uint256 amount2, enum UniswapAdapter.Exchange exchange) → uint256` (internal)





### `_convertEthToToken(uint256 inputAmount, address addr, uint256 amountOutMin, contract IUniswapV2Router02 router) → uint256` (internal)





### `_convertTokenToToken(address addr1, address addr2, uint256 amount, uint256 amountOutMin, contract IUniswapV2Router02 router) → uint256` (internal)





### `_addLiquidity(address token1, address token2, uint256 amount1, uint256 amount2, contract IUniswapV2Router02 router) → uint256` (internal)





### `_buyLp(uint256 userWbtcBal, enum UniswapAdapter.Exchange exchange, address traderAccount, uint256 tradeAmt, uint256 minDiggAmtOut)` (internal)





### `buyLp(address tokenInput, uint256 amt, string exchangeName, uint256 tradeAmt, uint256 minWbtcAmtOut, uint256 minDiggAmtOut)` (public)






