// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/InstrumentInterface.sol";
import "./BaseInstrumentStorage.sol";
import "../DToken.sol";
import "../DataProviderInterface.sol";
import "../lib/DSMath.sol";

contract BaseInstrument is ReentrancyGuard, DSMath, BaseInstrumentStorageV1 {
    using SafeERC20 for IERC20;

    /**
     * @notice Emitted when an account deposits collateral
     */
    event Deposited(address indexed account, uint256 amount);

    /**
     * @notice Emitted when an account deposits collateral
     */
    event Minted(address indexed account, uint256 amount);

    /**
     * @notice Emitted when an account repays collateral in a vault
     */
    event Repaid(
        address indexed repayer,
        address indexed vault,
        uint256 amount
    );

    /**
     * @notice Emitted when an account withdraws collateral in a vault
     */
    event Withdrew(address indexed account, uint256 amount);

    /**
     * @notice Emitted when an account withdraws all collateral from an expired instrument
     */
    event WithdrewExpired(address indexed account, uint256 amount);

    /**
     * @notice Emitted when dTokens are redeemed
     */
    event Redeemed(
        address indexed account,
        uint256 dTokenAmount,
        uint256 collateralAmount
    );

    /**
     * @notice Emitted when the instrument is settled
     */
    event Settled(uint256 indexed timestamp, uint256 settlePrice);

    /**
     * @notice Emitted when a vault is liquidated
     */
    event Liquidated(
        address indexed liquidator,
        address indexed liquidated,
        uint256 liquidateAmount,
        uint256 collateralLiquidated,
        uint256 newLiquidatorCollateral,
        uint256 newLiquidatorDebt
    );

    /**
     * @notice Gets the price of collateral asset
     */
    function getColPrice() public view returns (uint256) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.getPrice(collateralAsset);
    }

    /**
     * @notice Gets the price of target asset
     */
    function getTargetPrice() public view returns (uint256) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.getPrice(targetAsset);
    }

    /**
     * @notice Gets the collateral and debt of a vault
     * @param _user user's address
     */
    function getVault(address _user)
        public
        view
        returns (uint256 _collateral, uint256 _dTokenDebt)
    {
        Vault memory vault = vaults[_user];
        return (vault.collateral, vault.dTokenDebt);
    }

    /**
     * @notice function to determine if the transaction holds msg.value and is attempting to transfer native ETH
     * @param _msgValue is the msg.value passed by the calling function
     * @param _amount is the the collateral amount deposited
     */
    function isETHDeposit(uint256 _msgValue, uint256 _amount)
        internal
        pure
        returns (bool)
    {
        if (_msgValue == 0) {
            return false;
        }
        // Also double check that the msg.value matches the stated deposit amount
        require(_msgValue == _amount, "msg.value amount don't match _amount");
        return true;
    }

    /**
     * @notice function to determine if the collateral is WETH token
     */
    function collateralIsWETH() private view returns (bool) {
        return collateralAsset == getWETHAddress();
    }

    /**
     * @notice get weth address from DataProvider
     */
    function getWETHAddress() internal view returns (address) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.weth();
    }

    function raiseNotImplemented() internal view {
        require(false, "Not implemented");
    }
}
