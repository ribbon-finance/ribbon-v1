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

import "./HegicStaking.sol";
pragma solidity >=0.7.2;


contract HegicStakingWBTC is HegicStaking, IHegicStakingERC20 {
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    IERC20 public immutable WBTC;

    constructor(ERC20 _token, ERC20 wbtc) public
        HegicStaking(_token, "HEGIC WBTC Staking lot", "hlWBTC") {
        WBTC = wbtc;
    }

    function sendProfit(uint amount) external override {
        uint _totalSupply = totalSupply();
        if (_totalSupply > 0) {
            totalProfit += amount.mul(ACCURACY) / _totalSupply;
            WBTC.safeTransferFrom(msg.sender, address(this), amount);
            emit Profit(amount);
        } else {
            WBTC.safeTransferFrom(msg.sender, FALLBACK_RECIPIENT, amount);
        }
    }

    function _transferProfit(uint amount) internal override {
        WBTC.safeTransfer(msg.sender, amount);
    }
}
