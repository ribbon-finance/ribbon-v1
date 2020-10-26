// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../interfaces/InstrumentInterface.sol";

contract BaseInstrumentStorageV1 is InstrumentStorageInterface {
    string internal _name;
    string public symbol;
    uint256 public expiry;
    uint256 public collateralizationRatio;
    address public collateralAsset;
    address public targetAsset;
    address internal _dToken;
    address public dataProvider;
    bool public expired;
    uint256 public settlePrice;
    address public liquidatorProxy;
    uint256 public totalDebt;

    /**
     * @notice Vault struct contains collateral and dToken debt
     */
    struct Vault {
        uint256 collateral;
        uint256 dTokenDebt;
    }

    /**
     * @notice Mapping between an address and a vault
     */
    mapping(address => Vault) public vaults;

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
        return _dToken;
    }
}
