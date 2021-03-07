// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    ERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";

contract OptionsVaultStorageV1 is
    OwnableUpgradeable,
    ERC20Upgradeable,
    ReentrancyGuard
{
    // Ribbon Factory used to access adapters
    IRibbonFactory public factory;

    // Privileged role that is able to select the option terms (strike price, expiry) to short
    address public manager;

    // Option that the vault is currently shorting
    address public currentOption;

    // Amount that is currently locked for selling options
    uint256 public lockedAmount;

    // Cap for total amount deposited into vault
    uint256 public cap;
}
