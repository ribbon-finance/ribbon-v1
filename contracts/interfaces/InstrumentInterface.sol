// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {OptionType} from "../adapters/IProtocolAdapter.sol";

interface IAggregatedOptionsInstrument {
    function cost(
        string[] calldata venues,
        OptionType[] calldata optionTypes,
        uint256[] calldata amounts,
        uint256[] calldata strikePrices
    ) external view returns (uint256);

    function buyInstrument(
        string[] calldata venues,
        OptionType[] calldata optionTypes,
        uint256[] calldata amounts,
        uint256[] calldata strikePrices,
        bytes[] calldata buyData
    ) external payable returns (uint256 positionID);

    function exercisePosition(uint256 positionID)
        external
        returns (uint256 profit);

    function underlying() external returns (address);

    function strikeAsset() external returns (address);

    function collateralAsset() external returns (address);

    function expiry() external returns (uint256);
}

interface IVaultedInstrument {
    // Deposit and minting processes
    function deposit(uint256 collateralAmount) external payable;

    function mint(uint256 tokenAmount) external;

    function depositAndMint(uint256 collateralAmount, uint256 tokenAmount)
        external
        payable;

    function depositMintAndSell(
        uint256 collateral,
        uint256 dToken,
        uint256 maxSlippage
    ) external payable;

    // Withdrawals
    function withdrawAfterExpiry() external;

    // Debt repayment
    function repayDebt(address vault, uint256 debtAmount) external;

    // Redemption and settlement
    function settle() external;

    function redeem(uint256 tokenAmount) external;
}

interface IInstrumentStorage {
    function name() external view returns (string memory);

    function dToken() external view returns (address);

    function symbol() external view returns (string memory);
}
