// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

contract DojimaFactoryStorageV1 {
    /**
     * @notice Address of dataProvider contract
     */
    address public dataProvider;

    /**
     * @notice Storage gap to enable adding new variables
     */
    uint256[50] private __gap;

    /**
     * @notice Mapping of created instruments
     */
    mapping(string => address) public instruments;
}
