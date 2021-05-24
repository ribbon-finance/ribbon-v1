// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

contract MockYearnRegistry {
    mapping(address => address) public latestVault;

    constructor() {}

    /**
     * @notice Sets a new vault
     * @param base is the address of the underlying token
     * @param yield is the yield token based on the `base` token
     */
    function setVault(address base, address yield) external {
        latestVault[base] = yield;
    }
}
