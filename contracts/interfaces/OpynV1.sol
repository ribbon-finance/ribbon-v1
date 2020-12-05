// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

interface IUniswapFactory {
    function getExchange(address token)
        external
        view
        returns (address exchange);
}

interface IOptionsExchange {
    function uniswapFactory() external returns (IUniswapFactory);
}

interface IOToken {
    function optionsExchange() external returns (IOptionsExchange);
}
