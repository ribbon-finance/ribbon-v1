// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "../lib/upgrades/Initializable.sol";
import {Ownable} from "../lib/Ownable.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";

contract OptionsVaultStorageV1 is Initializable, Ownable {
    IRibbonFactory public factory;
}
