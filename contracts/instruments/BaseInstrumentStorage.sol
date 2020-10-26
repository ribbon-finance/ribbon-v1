// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

contract BaseInstrumentStorageV1 {
    string public name;
    string public symbol;
    uint256 public expiry;
    uint256 public collateralizationRatio;
    address public collateralAsset;
    address public targetAsset;
    address public dToken;
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
}
