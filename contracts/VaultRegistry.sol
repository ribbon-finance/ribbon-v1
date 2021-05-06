// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VaultRegistry is Ownable {
    /// @dev Register vaults that can withdraw for free to each other
    /// mapping(fromVault => mapping(toVault => true/false))
    mapping(address => mapping(address => bool)) public canWithdrawForFree;

    /// @dev Register vaults that can trade with each other
    /// mapping(longVault => mapping(shortVault => true/false))
    mapping(address => mapping(address => bool)) public canCrossTrade;

    event RegisterWithdrawal(address fromVault, address toVault);

    event RevokeWithdrawal(address fromVault, address toVault);

    event RegisterCrossTrade(address longVault, address shortVault);

    event RevokeCrossTrade(address longVault, address shortVault);

    function registerFreeWithdrawal(address fromVault, address toVault)
        external
        onlyOwner
    {
        canWithdrawForFree[fromVault][toVault] = true;
        emit RegisterWithdrawal(fromVault, toVault);
    }

    function revokeFreeWithdrawal(address fromVault, address toVault)
        external
        onlyOwner
    {
        canWithdrawForFree[fromVault][toVault] = false;
        emit RevokeWithdrawal(fromVault, toVault);
    }

    function registerCrossTrade(address longVault, address shortVault)
        external
        onlyOwner
    {
        canCrossTrade[longVault][shortVault] = true;
        emit RegisterCrossTrade(longVault, shortVault);
    }

    function revokeCrossTrade(address longVault, address shortVault)
        external
        onlyOwner
    {
        canCrossTrade[longVault][shortVault] = false;
        emit RevokeCrossTrade(longVault, shortVault);
    }
}
