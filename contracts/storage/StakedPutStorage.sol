// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

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

contract StakedPutStorageV1 is
    OwnableUpgradeable,
    ERC20Upgradeable,
    ReentrancyGuard
{
    struct InstrumentPosition {
        bool exercised;
        uint8 putVenueID;
        uint32 putOptionID;
        uint256 amount;
        uint256 putStrikePrice;
        uint256 expiry;
    }

    mapping(address => InstrumentPosition[]) instrumentPositions;

    function numOfPositions(address _account) public view returns (uint256) {
        return instrumentPositions[_account].length;
    }

    function getInstrumentPositions(address account)
        external
        view
        returns (InstrumentPosition[] memory positions)
    {
        return instrumentPositions[account];
    }

    function instrumentPosition(address account, uint256 positionID)
        external
        view
        returns (InstrumentPosition memory position)
    {
        return instrumentPositions[account][positionID];
    }
}
