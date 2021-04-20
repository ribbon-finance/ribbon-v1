pragma solidity ^0.7.2;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Hegic
 * Copyright (C) 2020 Hegic Protocol
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";


interface ILiquidityPool {
    struct LockedLiquidity { uint amount; uint premium; bool locked; }

    event Profit(uint indexed id, uint amount);
    event Loss(uint indexed id, uint amount);
    event Provide(address indexed account, uint256 amount, uint256 writeAmount);
    event Withdraw(address indexed account, uint256 amount, uint256 writeAmount);

    function unlock(uint256 id) external;
    function send(uint256 id, address payable account, uint256 amount) external;
    function setLockupPeriod(uint value) external;
    function totalBalance() external view returns (uint256 amount);
    // function unlockPremium(uint256 amount) external;
}


interface IERCLiquidityPool is ILiquidityPool {
    function lock(uint id, uint256 amount, uint premium) external;
    function token() external view returns (IERC20);
}


interface IETHLiquidityPool is ILiquidityPool {
    function lock(uint id, uint256 amount) external payable;
}


interface IHegicStaking {
    event Claim(address indexed acount, uint amount);
    event Profit(uint amount);


    function claimProfit() external returns (uint profit);
    function buy(uint amount) external;
    function sell(uint amount) external;
    function profitOf(address account) external view returns (uint);
}


interface IHegicStakingETH is IHegicStaking {
    function sendProfit() external payable;
}


interface IHegicStakingERC20 is IHegicStaking {
    function sendProfit(uint amount) external;
}


interface IHegicOptions {
    event Create(
        uint256 indexed id,
        address indexed account,
        uint256 settlementFee,
        uint256 totalFee
    );

    event Exercise(uint256 indexed id, uint256 profit);
    event Expire(uint256 indexed id, uint256 premium);
    enum State {Inactive, Active, Exercised, Expired}
    enum OptionType {Invalid, Put, Call}

    struct Option {
        State state;
        address payable holder;
        uint256 strike;
        uint256 amount;
        uint256 lockedAmount;
        uint256 premium;
        uint256 expiration;
        OptionType optionType;
    }

    function options(uint) external view returns (
        State state,
        address payable holder,
        uint256 strike,
        uint256 amount,
        uint256 lockedAmount,
        uint256 premium,
        uint256 expiration,
        OptionType optionType
    );
}

// For the future integrations of non-standard ERC20 tokens such as USDT and others
// interface ERC20Incorrect {
//     event Transfer(address indexed from, address indexed to, uint256 value);
//
//     event Approval(address indexed owner, address indexed spender, uint256 value);
//
//     function transfer(address to, uint256 value) external;
//
//     function transferFrom(
//         address from,
//         address to,
//         uint256 value
//     ) external;
//
//     function approve(address spender, uint256 value) external;
//     function balanceOf(address who) external view returns (uint256);
//     function allowance(address owner, address spender) external view returns (uint256);
//
// }