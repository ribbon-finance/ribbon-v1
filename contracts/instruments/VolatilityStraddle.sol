// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../lib/upgrades/Initializable.sol";
import "../interfaces/InstrumentInterface.sol";

import "./BaseInstrument.sol";

contract VolatilityStraddle is
    Initializable,
    InstrumentInterface,
    BaseInstrument
{
    using SafeERC20 for IERC20;

    function initialize(
        address _owner,
        address _dataProvider,
        string memory name,
        string memory symbol,
        uint256 _expiry,
        uint256 _strikePrice,
        uint256 _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset,
        address _paymentToken,
        address _liquidatorProxy,
        address _balancerFactory
    ) public initializer {
        require(block.timestamp < _expiry, "Expiry has already passed");

        owner = _owner;
        _name = name;
        _symbol = symbol;
        expiry = _expiry;
        collateralizationRatio = _collateralizationRatio;
        collateralAsset = _collateralAsset;
        targetAsset = _targetAsset;
        dataProvider = _dataProvider;
        liquidatorProxy = _liquidatorProxy;
        strikePrice = _strikePrice;
        paymentToken = _paymentToken;
        balancerFactory = _balancerFactory;
        expired = false;
    }

    /**
     * @notice Deposits collateral into the system. Calls the `depositInteral` function
     * @param _amount is amount of collateral to deposit
     */
    function deposit(uint256 _amount) public override payable nonReentrant {}

    /**
     * @notice Mints dTokens. Calls the `mintInternal` function
     * @param _amount is amount of dToken to mint
     */
    function mint(uint256 _amount) public override nonReentrant {}

    /**
     * @notice Deposits collateral and mints dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     */
    function depositAndMint(uint256 _collateral, uint256 _dToken)
        external
        override
        payable
        nonReentrant
    {}

    /**
     * @notice Deposits collateral, mints dToken, sells dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     * @param _maxSlippage is max % amount of slippage in WAD
     */
    function depositMintAndSell(
        uint256 _collateral,
        uint256 _dToken,
        uint256 _maxSlippage
    ) external override payable nonReentrant {}

    /**
     * @notice Repays dToken debt in a vault
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebt(address _account, uint256 _amount)
        public
        override
        nonReentrant
    {}

    /**
     * @notice Repays dToken debt in a vault
     * @param _repayer is the address who is paying down the debt with dTokens
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebtInternal(
        address _repayer,
        address _account,
        uint256 _amount
    ) internal {}

    /**
     * @notice Changes `expired` to True if timestamp is greater than expiry
     * It calculates the `settlePrice` with the current prices of target and
     * collateral assets, then sets them in stone.
     */
    function settle() public override {}

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint256 _dTokenAmount) external override nonReentrant {}

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawAfterExpiry() external override nonReentrant {}
}
