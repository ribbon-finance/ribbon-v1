// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {DSMath} from "../lib/DSMath.sol";

contract MockUniswapExchange is DSMath {
    uint256 public swapRate;

    function getEthToTokenOutputPrice(uint256 tokens_bought)
        external
        view
        returns (uint256 eth_sold)
    {
        eth_sold = wmul(tokens_bought, swapRate);
    }

    // Trade ETH to ERC20
    function ethToTokenSwapInput(uint256 min_tokens, uint256 deadline)
        external
        payable
        returns (uint256 tokens_bought)
    {
        tokens_bought = wdiv(msg.value, swapRate);
        require(tokens_bought >= min_tokens, "Not more than min_tokens");
    }

    function setSwapRate(uint256 rate) public {
        swapRate = rate;
    }
}

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
