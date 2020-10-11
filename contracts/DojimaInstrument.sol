// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./DToken.sol";
import "./DataProviderInterface.sol";
import "./lib/DSMath.sol";

contract DojimaInstrument is ReentrancyGuard, DSMath {
    using SafeERC20 for IERC20;

    string public name;
    string public symbol;
    uint public expiry;
    uint public collateralizationRatio;
    address public collateralAsset;
    address public targetAsset;
    address public dToken;
    address public dataProvider;
    bool public expired;
    uint public settlePrice;
    address public liquidatorProxy;
    uint public totalDebt;

    constructor(
        address _dataProvider,
        string memory _name,
        string memory _symbol,
        uint _expiry,
        uint _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset,
        address _liquidatorProxy
    ) public {
        require(block.timestamp < _expiry, "Expiry has already passed");

        name = _name;
        symbol = _symbol;
        expiry = _expiry;
        collateralizationRatio = _collateralizationRatio;
        collateralAsset = _collateralAsset;
        targetAsset = _targetAsset;
        dataProvider = _dataProvider;
        liquidatorProxy = _liquidatorProxy;

        // Init new DToken
        DToken newDToken = new DToken(_name, _symbol);
        dToken = address(newDToken);

        expired = false;
    }
   
    /**
     * @notice Vault struct contains collateral and dToken debt
     */
    struct Vault {
        uint collateral;
        uint dTokenDebt;
    }

    /**
     * @notice Mapping between an address and a vault
     */
    mapping(address => Vault) public vaults;

    /**
     * @notice Emitted when an account deposits collateral
     */
    event Deposited(address account, uint amount);

    /**
     * @notice Emitted when an account deposits collateral
     */
    event Minted(address account, uint amount);

    /**
     * @notice Emitted when an account repays collateral in a vault
     */
    event Repaid(address repayer, address vault, uint amount);

    /**
     * @notice Emitted when an account withdraws collateral in a vault
     */
    event Withdrew(address account, uint amount);

    /**
     * @notice Emitted when an account withdraws all collateral from an expired instrument
     */
    event WithdrewExpired(address account, uint amount);

    /**
     * @notice Emitted when dTokens are redeemed
     */
    event Redeemed(address account, uint dTokenAmount, uint collateralAmount);


    /**
     * @notice Emitted when the instrument is settled
     */
    event Settled(
        uint timestamp,
        uint settlePrice,
        uint targetAssetPrice,
        uint collateralAssetPrice
    );

    /**
     * @notice Emitted when a vault is liquidated
     */
    event Liquidated(
        address liquidator,
        address liquidated,
        uint liquidateAmount,
        uint collateralLiquidated,
        uint newLiquidatorCollateral,
        uint newLiquidatorDebt
    );

    /**
     * @notice Changes `expired` to True if timestamp is greater than expiry
     * It calculates the `settlePrice` with the current prices of target and
     * collateral assets, then sets them in stone.
     */
    function settle() public {
        require(block.timestamp > expiry, "Instrument has not expired");
        expired = true;

        // Set settlePrice to the current price of target and collat assets
        DataProviderInterface data = DataProviderInterface(dataProvider);
        uint targetAssetPrice = data.getPrice(targetAsset);
        uint collateralAssetPrice = data.getPrice(collateralAsset);
        
        settlePrice = computeSettlePrice(targetAssetPrice, collateralAssetPrice);

        emit Settled(block.timestamp, settlePrice, targetAssetPrice, collateralAssetPrice);
    }

    /**
     * @notice Gets the price of collateral asset
     */
    function getColPrice() public view returns(uint) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.getPrice(collateralAsset);
    }

    /**
     * @notice Gets the price of target asset
     */
    function getTargetPrice() public view returns(uint) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.getPrice(targetAsset);
    }

    /**
     * @notice Gets the collateral and debt of a vault
     * @param _user user's address
     */
    function getVault(address _user) public view returns(uint _collateral, uint _dTokenDebt) {
        Vault memory vault = vaults[_user];
        return (vault.collateral, vault.dTokenDebt);
    }

    /**
     * @notice Gets col ratio of a vault given new colAmount and dTokenAmount
     * @param _user address of vault
     * @param _colAmount amount of collateral to change
     * @param _colSign true if adding, false if removing
     * @param _dTokenAmount amount of dTokenAmount to change
     * @param _dTokenSign true if adding, false if removing
     */
    function getNewColRatio(address _user, uint _colAmount, bool _colSign, uint _dTokenAmount, bool _dTokenSign) public view returns(uint) {
        uint newCol;
        uint newDebt;
        Vault memory vault = vaults[_user];
        if (_colSign) {
            newCol = add(vault.collateral, _colAmount);
        } else {
            newCol = sub(vault.collateral, _colAmount);
        }

        if (_dTokenSign) {
            newDebt = add(vault.dTokenDebt, _dTokenAmount);
        } else {
            newDebt = sub(vault.dTokenDebt, _dTokenAmount);
        }

        DataProviderInterface data = DataProviderInterface(dataProvider);
        return computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            newCol,
            newDebt
        );
    }

    /**
     * @notice Deposits collateral into the system. Calls the `depositInteral` function
     * @param _amount is amount of collateral to deposit
     */
    function deposit(uint _amount) public nonReentrant {
        depositInternal(_amount);
    }

    /**
     * @notice Deposits collateral into the Instrument contract and credits the caller's vault
     * @param _amount is amount of collateral to deposit
     */
    function depositInternal(uint _amount) internal {
        require(!expired, "Instrument must not be expired");

        IERC20 colToken = IERC20(collateralAsset);
      
        Vault storage vault = vaults[msg.sender];
        vault.collateral = add(vault.collateral, _amount);
      
        colToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposited(msg.sender, _amount);
    }

    /**
     * @notice Mints dTokens. Calls the `mintInternal` function
     * @param _amount is amount of dToken to mint
     */
    function mint(uint _amount) public nonReentrant {
        mintInternal(_amount);
    }

    /**
     * @notice Mints dTokens and debits the debt in the caller's vault
     * @param _amount is amount of dToken to mint
     */
    function mintInternal(uint _amount) internal {
        require(!expired, "Instrument must not be expired");
        DataProviderInterface data = DataProviderInterface(dataProvider);
        Vault storage vault = vaults[msg.sender];

        uint newDebt = add(vault.dTokenDebt, _amount);
        uint newColRatio = computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            vault.collateral,
            newDebt);

        require(
            newColRatio >= collateralizationRatio,
            "Collateralization ratio too low"
        );
        vault.dTokenDebt = newDebt;
        totalDebt = add(totalDebt, _amount);

        DToken dTokenContract = DToken(dToken);
        dTokenContract.mint(msg.sender, _amount);
        emit Minted(msg.sender, _amount);
    }

    /**
     * @notice Deposits collateral and mints dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     */
    function depositAndMint(uint256 _collateral, uint256 _dToken) external nonReentrant {
        depositInternal(_collateral);
        mintInternal(_dToken);
    }

    // /**
    //  * @notice Liquidates a vault using collateral and debt from another vault
    //  * @param _liquidator is the address of the liquidator
    //  * @param _liquidatee is the address of the vault being liquidated
    //  * @param _dTokenAmount is the dToken debt amount to be repaid for the liquidation
    //  * @param _liquidationIncentive the % amount of collateral the liquidators can take as a reward
    //  */
    function liquidateFromVault(
        address _liquidator,
        address _liquidatee,
        uint256 _dTokenAmount,
        uint256 _liquidationIncentive
    ) external nonReentrant {
        // No other caller except the assigned proxy can liquidate
        require(msg.sender == liquidatorProxy, "Only liquidatorProxy");
        require(!expired, "Instrument must not be expired");
        
        Vault storage liquidatorVault = vaults[_liquidator];
        Vault storage liquidatedVault = vaults[_liquidatee];
        uint256 liquidateeDTokenDebt = liquidatedVault.dTokenDebt;
        uint256 liquidateeCollateral = liquidatedVault.collateral;

        require(_dTokenAmount <= liquidateeDTokenDebt, "Cannot liquidate more than debt");

        DataProviderInterface data = DataProviderInterface(dataProvider);
        uint256 collateralPrice = data.getPrice(collateralAsset);
        uint256 targetPrice = data.getPrice(targetAsset);

        // Check if the vault is under the Instrument's collateralizationRatio
        uint256 minColRatio = collateralizationRatio;
        require(
            computeColRatio(collateralPrice, targetPrice, liquidateeCollateral, liquidateeDTokenDebt) < minColRatio,
            "Vault not liquidatable"
        );

        // Calculates the outcome for the liquidator's vault
        (uint256 collateralLiquidated, uint256 newLiquidatorCollateral, uint256 newLiquidatorDebt) = calculateLiquidationVaultOutcome(
            liquidatorVault.collateral, liquidatorVault.dTokenDebt, _dTokenAmount, _liquidationIncentive, targetPrice, collateralPrice);

        // After the liquidator accepts the new debt and collateral * 1.05,
        // We need to check that the liquidator is still overcollateralized
        require(
            computeColRatio(collateralPrice, targetPrice, newLiquidatorCollateral, newLiquidatorDebt) >= minColRatio,
            "Liquidator is undercollateralized"
        );

        // This covers the cases where the vault is underwater
        // Just liquidate the entire vault's collateral if the calculated collateralLiquidated is more than vault's collateral
        if (collateralLiquidated > liquidateeCollateral) {
            collateralLiquidated = liquidateeCollateral;
        }

        // Finally we have to assign the new values to the liquidator and liquidated vault
        liquidatorVault.collateral = newLiquidatorCollateral;
        liquidatorVault.dTokenDebt = newLiquidatorDebt;
        liquidatedVault.collateral = sub(liquidateeCollateral, collateralLiquidated);

        // The repayDebtInternal subtracts the debt amount
        repayDebtInternal(_liquidator, _liquidatee, _dTokenAmount);
        emit Liquidated(_liquidator, _liquidatee, _dTokenAmount, collateralLiquidated, newLiquidatorCollateral, newLiquidatorDebt);
    }

    /**
     * @notice Calculates the liquidator vault's collateral and debt after a liquidation
     * @param _originalLiquidatorCollateral is the collateral amount the liquidator vault has
     * @param _originalLiquidatorDebt is the debt amount the liquidator vault has
     * @param _dTokenAmount is the dToken debt amount to be repaid for the liquidation
     * @param _liquidationIncentive the % amount of collateral the liquidators can take as a reward
     * @param _targetPrice target asset price
     * @param _collateralPrice collateral asset price
     */
    function calculateLiquidationVaultOutcome(
        uint256 _originalLiquidatorCollateral,
        uint256 _originalLiquidatorDebt,
        uint256 _dTokenAmount,
        uint256 _liquidationIncentive,
        uint256 _targetPrice,
        uint256 _collateralPrice
    ) internal pure returns(uint256, uint256, uint256) {
        uint256 debtValue = wmul(_dTokenAmount, _targetPrice); // in ETH
        uint256 collateralValue = wdiv(debtValue, _collateralPrice); // in collateral tokens
        uint256 collateralLiquidated = wmul(collateralValue, _liquidationIncentive);

        uint256 newLiquidatorCollateral = add(_originalLiquidatorCollateral, collateralLiquidated);
        uint256 newLiquidatorDebt = add(_originalLiquidatorDebt, _dTokenAmount);
        return (collateralLiquidated, newLiquidatorCollateral, newLiquidatorDebt);
    }

    /**
     * @notice Checks if vault is under collateralized
     * @param _vaultOwner is the vault to check if it is liquidatable
     */
    function isLiquidatable(address _vaultOwner) external view returns (bool) {
        uint256 colRatio = vaultCollateralizationRatio(_vaultOwner);
        return colRatio < collateralizationRatio;
    }

    /**
     * @notice Helper function to get the collateralization ratio of a vault
     * @param _vaultOwner is the address used to lookup the vault
     */
    function vaultCollateralizationRatio(address _vaultOwner) public view returns(uint256) {
        (uint256 collateral, uint256 debt) = getVault(_vaultOwner);
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            collateral,
            debt
        );
    }

    /**
     * @notice Repays dToken debt in a vault
     * @param _repayer is the address who is paying down the debt with dTokens
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebtInternal(address _repayer, address _account, uint _amount) internal {
        // Only the liquidator proxy can repay debt on behalf of liquidators
        if (msg.sender != _account) {
            require(msg.sender == liquidatorProxy, "Only liquidatorProxy");
        }

        Vault storage vault = vaults[_account];
        require(vault.dTokenDebt >= _amount, "Cannot repay more debt than exists");
        
        vault.dTokenDebt = sub(vault.dTokenDebt, _amount);
        totalDebt = sub(totalDebt, _amount);

        DToken dTokenContract = DToken(dToken);
        dTokenContract.burn(_repayer, _amount);
        emit Repaid(_repayer, _account, _amount);
    }

    /**
     * @notice Repays dToken debt in a vault
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebt(address _account, uint _amount) public nonReentrant {
        repayDebtInternal(msg.sender, _account, _amount);
    }

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawCollateralExpired() external nonReentrant {
        require(expired, "Instrument must be expired");
        Vault storage vault = vaults[msg.sender];

        uint withdrawableColAmount = wmul(settlePrice, vault.dTokenDebt);
        vault.collateral = sub(vault.collateral, withdrawableColAmount);
        IERC20 colToken = IERC20(collateralAsset);
        colToken.safeTransfer(msg.sender, withdrawableColAmount);
        emit WithdrewExpired(msg.sender, withdrawableColAmount);
    }

    /**
     * @notice Withdraws collateral while the instrument is active
     * @param _amount is amount of collateral to withdraw
     */
    function withdrawCollateral(uint _amount) external nonReentrant {
        withdrawCollateralInternal(msg.sender, _amount);
    }

    /**
     * @notice Withdraws collateral from a vault
     * @param _account is account that is withdrawing
     * @param _amount is amount of collateral to withdraw
     */
    function withdrawCollateralInternal(address _account, uint _amount) internal {
        require(!expired, "Instrument must not be expired");
        DataProviderInterface data = DataProviderInterface(dataProvider);
        Vault storage vault = vaults[_account];

        uint newCol = sub(vault.collateral, _amount);
        uint newColRatio = computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            newCol,
            vault.dTokenDebt);
        
        require(
            newColRatio >= collateralizationRatio,
            "Collateralization ratio too low to withdraw"
        );
        vault.collateral = newCol;

        IERC20 colToken = IERC20(collateralAsset);
        colToken.safeTransfer(_account, _amount);
        emit Withdrew(msg.sender, _amount);
    }

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint _dTokenAmount) external nonReentrant {
        require(expired, "Instrument must be expired");

        uint withdrawableColAmount = wmul(settlePrice, _dTokenAmount);

        totalDebt = sub(totalDebt, _dTokenAmount);

        DToken dTokenContract = DToken(dToken);
        dTokenContract.burn(msg.sender, _dTokenAmount);
        
        IERC20 colTokenContract = IERC20(collateralAsset);
        colTokenContract.safeTransfer(msg.sender, withdrawableColAmount);

        emit Redeemed(msg.sender, _dTokenAmount, withdrawableColAmount);
    }

    /**
     * @notice Computes col ratio
     * @dev 150% CR will be represented as 1.5 * WAD
     * @param _colPrice is the spot price of collateral asset in WAD
     * @param _targetPrice is the spot price of the target asset in WAD
     * @param _colAmount is the amount of collateral in WAD
     * @param _targetAmount is the amount of dTokens in WAD
     */
    function computeColRatio(
        uint _colPrice,
        uint _targetPrice,
        uint _colAmount,
        uint _targetAmount
    ) internal pure returns (uint) {
        uint col = wmul(_colPrice, _colAmount);
        uint debt = wmul(_targetAmount, _targetPrice);
        if (debt == 0) {
            return type(uint256).max;
        }
        return wdiv(col, debt);
    }

    /**
     * @notice Returns the number of collateralAsset that can be exchanged for 1 dToken.
     * @dev 1:1 is denominated as 1*WAD
     * @param _targetPrice is the spot price of the target asset in WAD
     * @param _colPrice is the spot price of collateral asset in WAD
     */
    function computeSettlePrice(
        uint _targetPrice,
        uint _colPrice
    ) internal pure returns (uint) {
        return wdiv(_targetPrice, _colPrice);
    }
}

