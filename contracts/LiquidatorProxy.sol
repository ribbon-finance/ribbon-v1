// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./lib/upgrades/Initializable.sol";
import "./DojimaInstrument.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidatorProxyStorageV1 {
    address public owner;
    uint256 public liquidationIncentive;
}

contract LiquidatorProxy is ReentrancyGuard, Initializable, LiquidatorProxyStorageV1 {
    /**
     * @notice Initializes the LiquidatorProxy with the owner and liquidation incentive set for the protocol
     * @param _owner of the contract
     * @param _liquidationIncentive the % amount of collateral the liquidators can take as a reward
     */
    function initialize(address _owner, uint256 _liquidationIncentive) public initializer {
        owner = _owner;
        liquidationIncentive = _liquidationIncentive;
    }

    /**
     * @notice Initializes the LiquidatorProxy with the owner and liquidation incentive set for the protocol
     * @param _instrument is the address of the instrument that hosts vaults
     * @param _vaultOwner is the address of liquidated vault
     * @param _dTokenAmount is the dToken debt amount to be repaid for the liquidation
     */
    function liquidate(address _instrument, address _vaultOwner, uint256 _dTokenAmount) external {
        DojimaInstrument instrumentContract = DojimaInstrument(_instrument);
        instrumentContract.liquidateFromVault(msg.sender, _vaultOwner, _dTokenAmount, liquidationIncentive);
    }
}
