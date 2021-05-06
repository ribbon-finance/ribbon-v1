// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Detailed is IERC20 {
    function decimals() external returns (uint8);
}
