// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "../interfaces/InstrumentInterface.sol";

contract DojiVolatilityStorageV1 is InstrumentStorageInterface {
    address public owner;
    address public hegicOptions;
    uint256 public strikePrice;
    uint256 public expiry;
    string public _name;
    string public _symbol;

    struct InstrumentPosition {
        bool exercised;
        uint8 callProtocol;
        uint8 putProtocol;
        uint32 callOptionID;
        uint32 putOptionID;
        uint256 callAmount;
        uint256 putAmount;
    }

    mapping(address => InstrumentPosition[]) public instrumentPositions;

    /**
     * @notice Returns the name of the contract
     */
    function name() public virtual override view returns (string memory) {
        return _name;
    }

    /**
     * @notice Returns the dToken of the instrument
     */
    function dToken() public virtual override view returns (address) {
        return address(0);
    }

    /**
     * @notice Returns the symbol of the instrument
     */
    function symbol() public virtual override view returns (string memory) {
        return _symbol;
    }

    /**
     * @notice Returns the symbol of the instrument
     * @param _account is the address which has opened InstrumentPositions
     */
    function numOfPositions(address _account) public view returns (uint256) {
        return instrumentPositions[_account].length;
    }
}
