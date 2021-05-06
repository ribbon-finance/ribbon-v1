// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

interface IOptionsVault {
    function deposit(uint256 amount) external;

    function withdraw(uint256 shares) external;

    function asset() external returns (address);

    function currentOption() external returns (address);

    function nextOption() external returns (address);
}

interface ILongOptionsVault is IOptionsVault {
    function nextPremium() external returns (uint256);

    function nextPurchaseAmount() external returns (uint256);
}
