// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../interfaces/InstrumentInterface.sol";

contract DojiVolatilityStorageV1 is InstrumentStorageInterface {
    address public owner;
    address public hegicOption;
    uint256 public strikePrice;
    uint256 public expiry;
    string public _name;
    string public _symbol;

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
}
