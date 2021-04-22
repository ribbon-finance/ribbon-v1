pragma solidity >=0.7.2;

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

import "./Interfaces.sol";


/**
 * @author 0mllwntrmt3
 * @title Hegic WBTC Liquidity Pool
 * @notice Accumulates liquidity in WBTC from LPs and distributes P&L in WBTC
 */
contract HegicERCPool is
    IERCLiquidityPool,
    Ownable,
    ERC20("Hegic WBTC LP Token", "writeWBTC")
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    uint256 public constant INITIAL_RATE = 1e13;
    uint256 public lockupPeriod = 2 weeks;
    uint256 public lockedAmount;
    uint256 public lockedPremium;
    mapping(address => uint256) public lastProvideTimestamp;
    mapping(address => bool) public _revertTransfersInLockUpPeriod;
    LockedLiquidity[] public lockedLiquidity;
    IERC20 public override token;

    /*
     * @return _token WBTC Address
     */
    constructor(IERC20 _token) public {
        token = _token;
    }

    /**
     * @notice Used for changing the lockup period
     * @param value New period value
     */
    function setLockupPeriod(uint256 value) external override onlyOwner {
        require(value <= 60 days, "Lockup period is too large");
        lockupPeriod = value;
    }

    /*
     * @nonce calls by HegicPutOptions to lock funds
     * @param amount Amount of funds that should be locked in an option
     */
    function lock(uint id, uint256 amount, uint256 premium) external override onlyOwner {
        require(id == lockedLiquidity.length, "Wrong id");

        require(
            lockedAmount.add(amount).mul(10) <= totalBalance().mul(8),
            "Pool Error: Amount is too large."
        );

        lockedLiquidity.push(LockedLiquidity(amount, premium, true));
        lockedPremium = lockedPremium.add(premium);
        lockedAmount = lockedAmount.add(amount);
        token.safeTransferFrom(msg.sender, address(this), premium);
    }

    /*
     * @nonce Calls by HegicPutOptions to unlock funds
     * @param amount Amount of funds that should be unlocked in an expired option
     */
    function unlock(uint256 id) external override onlyOwner {
        LockedLiquidity storage ll = lockedLiquidity[id];
        require(ll.locked, "LockedLiquidity with such id has already unlocked");
        ll.locked = false;

        lockedPremium = lockedPremium.sub(ll.premium);
        lockedAmount = lockedAmount.sub(ll.amount);

        emit Profit(id, ll.premium);
    }

    /*
     * @nonce calls by HegicPutOptions to unlock the premiums after an option's expiraton
     * @param to Provider
     * @param amount Amount of premiums that should be unlocked
     */
    /*
     * @nonce calls by HegicCallOptions to send funds to liquidity providers after an option's expiration
     * @param to Provider
     * @param amount Funds that should be sent
     */
    function send(uint id, address payable to, uint256 amount)
        external
        override
        onlyOwner
    {
        LockedLiquidity storage ll = lockedLiquidity[id];
        require(ll.locked, "LockedLiquidity with such id has already unlocked");
        require(to != address(0));

        ll.locked = false;
        lockedPremium = lockedPremium.sub(ll.premium);
        lockedAmount = lockedAmount.sub(ll.amount);

        uint transferAmount = amount > ll.amount ? ll.amount : amount;
        token.safeTransfer(to, transferAmount);

        if (transferAmount <= ll.premium)
            emit Profit(id, ll.premium - transferAmount);
        else
            emit Loss(id, transferAmount - ll.premium);
    }

    /*
     * @nonce A provider supplies WBTC to the pool and receives writeWBTC tokens
     * @param amount Provided tokens
     * @param minMint Minimum amount of tokens that should be received by a provider.
                      Calling the provide function will require the minimum amount of tokens to be minted.
                      The actual amount that will be minted could vary but can only be higher (not lower) than the minimum value.
     * @return mint Amount of tokens to be received
     */
    function provide(uint256 amount, uint256 minMint) external returns (uint256 mint) {
        lastProvideTimestamp[msg.sender] = block.timestamp;
        uint supply = totalSupply();
        uint balance = totalBalance();
        if (supply > 0 && balance > 0)
            mint = amount.mul(supply).div(balance);
        else
            mint = amount.mul(INITIAL_RATE);

        require(mint >= minMint, "Pool: Mint limit is too large");
        require(mint > 0, "Pool: Amount is too small");
        _mint(msg.sender, mint);
        emit Provide(msg.sender, amount, mint);

        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Token transfer error: Please lower the amount of premiums that you want to send."
        );
    }

    /*
     * @nonce Provider burns writeWBTC and receives WBTC from the pool
     * @param amount Amount of WBTC to receive
     * @param maxBurn Maximum amount of tokens that can be burned
     * @return mint Amount of tokens to be burnt
     */
    function withdraw(uint256 amount, uint256 maxBurn) external returns (uint256 burn) {
        require(
            lastProvideTimestamp[msg.sender].add(lockupPeriod) <= block.timestamp,
            "Pool: Withdrawal is locked up"
        );
        require(
            amount <= availableBalance(),
            "Pool Error: You are trying to unlock more funds than have been locked for your contract. Please lower the amount."
        );

        burn = divCeil(amount.mul(totalSupply()), totalBalance());

        require(burn <= maxBurn, "Pool: Burn limit is too small");
        require(burn <= balanceOf(msg.sender), "Pool: Amount is too large");
        require(burn > 0, "Pool: Amount is too small");

        _burn(msg.sender, burn);
        emit Withdraw(msg.sender, amount, burn);
        require(token.transfer(msg.sender, amount), "Insufficient funds");
    }

    /*
     * @nonce Returns provider's share in WBTC
     * @param account Provider's address
     * @return Provider's share in WBTC
     */
    function shareOf(address user) external view returns (uint256 share) {
        uint supply = totalSupply();
        if (supply > 0)
            share = totalBalance().mul(balanceOf(user)).div(supply);
        else
            share = 0;
    }

    /*
     * @nonce Returns the amount of WBTC available for withdrawals
     * @return balance Unlocked amount
     */
    function availableBalance() public view returns (uint256 balance) {
        return totalBalance().sub(lockedAmount);
    }

    /*
     * @nonce Returns the WBTC total balance provided to the pool
     * @return balance Pool balance
     */
    function totalBalance() public override view returns (uint256 balance) {
        return token.balanceOf(address(this)).sub(lockedPremium);
    }

    function _beforeTokenTransfer(address from, address to, uint256) internal override {
        if (
            lastProvideTimestamp[from].add(lockupPeriod) > block.timestamp &&
            lastProvideTimestamp[from] > lastProvideTimestamp[to]
        ) {
            require(
                !_revertTransfersInLockUpPeriod[to],
                "the recipient does not accept blocked funds"
            );
            lastProvideTimestamp[to] = lastProvideTimestamp[from];
        }
    }

    function divCeil(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0);
        uint256 c = a / b;
        if (a % b != 0)
            c = c + 1;
        return c;
    }
}
