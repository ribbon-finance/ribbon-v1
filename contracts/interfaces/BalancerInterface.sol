// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

interface BalancerFactory {
    function isBPool(address pool) external returns (bool);

    function newBPool() external returns (BalancerPool);
}

interface BalancerPool {
    function finalize() external;

    function bind(
        address token,
        uint256 balance,
        uint256 denorm
    ) external;

    function setSwapFee(uint256 swapFee) external;

    function swapExactAmountIn(
        address tokenIn,
        uint256 tokenAmountIn,
        address tokenOut,
        uint256 minAmountOut,
        uint256 maxPrice
    ) external returns (uint256 tokenAmountOut, uint256 spotPriceAfter);

    function getSpotPrice(address tokenIn, address tokenOut)
        external
        returns (uint256);
}
