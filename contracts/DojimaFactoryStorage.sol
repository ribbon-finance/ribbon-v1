// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

contract DojimaFactoryStorageV1 {
    /**
     * @notice Address of contract owner
     */
    address public owner;

    /**
     * @notice Address of dataProvider contract
     */
    address public dataProvider;

    /**
     * @notice Address of the liquidator proxy contract
     */
    address public liquidatorProxy;

    /**
     * @notice Address of the admin of all instruments
     */
    address public instrumentAdmin;

    /**
     * @notice Mapping of created instruments
     */
    mapping(string => address) public instruments;
}
