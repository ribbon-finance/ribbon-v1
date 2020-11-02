// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

interface InstrumentInterface {
    // Deposit and minting processes
    function deposit(uint256 collateralAmount) external;

    function mint(uint256 tokenAmount) external;

    function depositAndMint(uint256 collateralAmount, uint256 tokenAmount)
        external;

    // Withdrawals
    function withdrawAfterExpiry() external;

    // Debt repayment
    function repayDebt(address vault, uint256 debtAmount) external;

    // Redemption and settlement
    function settle() external;

    function redeem(uint256 tokenAmount) external;
}

interface InstrumentStorageInterface {
    function name() external view returns (string memory);

    function dToken() external view returns (address);
}
