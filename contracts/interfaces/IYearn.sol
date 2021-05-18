// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

interface IYearnVault {
    function pricePerShare() external view returns (uint256);

    function deposit(uint256 _amount, address _recipient)
        external
        returns (uint256);

    function withdraw(
        uint256 _maxShares,
        address _recipient,
        uint256 _maxLoss
    ) external returns (uint256);

    function approve(address _recipient, uint256 _amount)
        external
        returns (bool);
}

interface IYearnRegistry {
    function latestVault(address token) external returns (address);
}
