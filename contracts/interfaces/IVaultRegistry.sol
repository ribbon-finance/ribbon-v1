// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

interface IVaultRegistry {
    function canWithdrawForFree(address fromVault, address toVault)
        external
        returns (bool);

    function canCrossTrade(address longVault, address shortVault)
        external
        returns (bool);
}
