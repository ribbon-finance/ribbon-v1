// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IOtoken} from "../interfaces/GammaInterface.sol";

contract MockGammaController {
    using SafeMath for uint256;

    uint256 public price;
    address public oracle;

    constructor(address _oracle) public {
        oracle = _oracle;
    }

    function getPayout(address _otoken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        IOtoken oToken = IOtoken(_otoken);
        uint256 strikePrice = oToken.strikePrice();

        if (strikePrice >= price) {
            return _amount;
        }

        uint256 payout = (price.sub(strikePrice)).mul(_amount).div(10**8);
        return (payout.mul(10**6)).div(10**8);
    }

    function setPrice(uint256 amount) public {
        price = amount;
    }
}
