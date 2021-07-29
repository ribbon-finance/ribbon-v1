// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

interface IRibbonV2Vault {
    function depositFor(uint256 amount, address creditor) external;
}

interface IRibbonV1Vault {
    function deposit(uint256 amount) external;
}
