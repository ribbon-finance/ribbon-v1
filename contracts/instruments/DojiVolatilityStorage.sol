// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "../interfaces/InstrumentInterface.sol";
import {IDojiFactory} from "../interfaces/IDojiFactory.sol";
import {OptionType} from "../adapters/IProtocolAdapter.sol";

contract DojiVolatilityStorageV1 {
    address public owner;
    IDojiFactory public factory;
    address public underlying;
    address public strikeAsset;
    uint256 public callStrikePrice;
    uint256 public putStrikePrice;
    uint256 public expiry;
    string public name;
    string public symbol;

    struct InstrumentPosition {
        bool exercised;
        string[] venues;
        OptionType[] optionTypes;
        uint256[] amounts;
        uint32[] optionIDs;
    }

    mapping(address => InstrumentPosition[]) public instrumentPositions;

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
