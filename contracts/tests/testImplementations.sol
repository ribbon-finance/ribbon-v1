pragma solidity >=0.7.2;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Hegic
 * Copyright (C) 2020 Hegic
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
import "./Interfaces.sol";
import "./StakingRewards.sol";
import "./HegicETHOptions.sol";

contract FakeExchange {
    uint256 public exchangeRate;
    FakeWBTC public token;
    address public WETH = address(this);

    constructor(FakeWBTC t, uint _exchangeRate) public {
        token = t;
        exchangeRate = _exchangeRate;
    }

    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint)
        external
        payable
        returns (uint[] memory amounts)
    {
        uint amountIn = getAmountsIn(amountOut, path)[0];
        require(msg.value >= amountIn, "Fake Uniswap: value is too small");
        amounts = new uint[](1);
        amounts[0] = msg.value;

        token.mintTo(to, amountOut);
    }

    function getAmountsIn(uint amountOut, address[] memory)
        public
        view
        returns (uint[] memory amounts)
    {
        amounts = new uint[](1);
        amounts[0] = amountOut * exchangeRate / 1e18;
    }
}


contract FakePriceProvider is AggregatorV3Interface {
    uint256 public price;
    uint8 public override decimals = 8;
    string public override description = "Test implementatiln";
    uint256 public override version = 0;

    constructor(uint256 _price) public {
        price = _price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getRoundData(uint80) external override view returns (uint80, int256, uint256, uint256, uint80) {
        revert("Test implementation");
    }

    function latestAnswer() external view returns(int result) {
        (, result, , , ) = latestRoundData();
    }

    function latestRoundData()
        public
        override
        view
        returns (
            uint80,
            int256 answer,
            uint256,
            uint256,
            uint80
        )
    {
        answer = int(price);
    }
}

contract FakeWBTC is ERC20("FakeWBTC", "FAKE") {
    constructor() public {
        _setupDecimals(8);
    }

    function mintTo(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}

contract FakeDIGG is ERC20("FakeDIGG", "FAKE") {
    constructor() public {
        _setupDecimals(8);
    }

    function mintTo(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}

contract FakeHEGIC is ERC20("FakeHEGIC", "FAKEH") {
    function mintTo(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}


contract ETHStakingRewards is StakingRewards {
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    ) public StakingRewards(_owner, _rewardsDistribution, _rewardsToken, _stakingToken) {}
}


contract WBTCStakingRewards is StakingRewards {
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    ) public StakingRewards(_owner, _rewardsDistribution, _rewardsToken, _stakingToken) {}
}

contract BrokenETHOptions is HegicETHOptions {
    constructor(AggregatorV3Interface pp, IHegicStakingETH staking)
        public HegicETHOptions(pp, staking, new HegicETHPool())
    {

    }
}

