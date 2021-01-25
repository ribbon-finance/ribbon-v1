// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "../lib/upgrades/Initializable.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {OptionType} from "../adapters/IProtocolAdapter.sol";
import {Ownable} from "../lib/Ownable.sol";

contract InstrumentStorageV1 is Initializable, Ownable, ReentrancyGuard {
    IRibbonFactory public factory;
    address public underlying;
    address public strikeAsset;
    address public collateralAsset;
    uint256 public expiry;
    string public name;
    string public symbol;
    mapping(address => InstrumentPosition[]) public instrumentPositions;

    uint256[100] private __instrumentGap;

    struct InstrumentPosition {
        bool exercised;
        OptionType[] optionTypes;
        uint32[] optionIDs;
        uint256[] amounts;
        uint256[] strikePrices;
        string[] venues;
    }

    /**
     * @notice Returns the symbol of the instrument
     * @param _account is the address which has opened InstrumentPositions
     */
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
