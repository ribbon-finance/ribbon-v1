// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./InstrumentInterface.sol";

interface LiquidatableInstrumentInterface is InstrumentInterface {
    // Withdrawals
    function withdrawCollateral(uint256 collateralAmount) external;

    // Liquidation
    function liquidateFromVault(
        address liquidator,
        address liquidatee,
        uint256 tokenAmount,
        uint256 liquidationIncentive
    ) external;
}