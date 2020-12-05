// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

contract MockUniswapExchange {}

contract MockUniswapFactory {
    mapping(address => address) public getExchange;

    function setExchange(address token, address exchange)
        public
        returns (address)
    {
        getExchange[token] = exchange;
    }
}

contract MockOptionsExchange {
    address public uniswapFactory;

    function setFactory(address _factory) external {
        uniswapFactory = _factory;
    }
}

contract MockOToken {
    address public optionsExchange;

    function setOptionsExchange(address _optionsExchange)
        external
        returns (address)
    {
        optionsExchange = _optionsExchange;
    }
}
