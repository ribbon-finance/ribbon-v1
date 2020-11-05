// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../lib/upgrades/Initializable.sol";
import "../interfaces/InstrumentInterface.sol";

import "./BaseInstrument.sol";
import "../Balancer.sol";

contract TwinYield is
    Initializable,
    Balancer,
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

        // Init new DToken
        DToken newDToken = new DToken(name, symbol);
        address dToken = address(newDToken);
        _dToken = dToken;

        Balancer.initialize(_owner, _balancerFactory, dToken, _paymentToken);
    }

    /**
     * @notice Deposits collateral into the system. Calls the `depositInteral` function
     * @param _amount is amount of collateral to deposit
     */
    function deposit(uint256 _amount) public override nonReentrant {
        depositInternal(_amount);
    }

    /**
     * @notice Deposits collateral into the Instrument contract and credits the caller's vault
     * @param _amount is amount of collateral to deposit
     */
    function depositInternal(uint256 _amount) internal {
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
    function mint(uint256 _amount) public override nonReentrant {
        mintInternal(msg.sender, _amount);
    }

    /**
     * @notice Mints dTokens and debits the debt in the caller's vault
     * @param _amount is amount of dToken to mint
     */
    function mintInternal(address _recipient, uint256 _amount) internal {
        require(!expired, "Instrument must not be expired");
        Vault storage vault = vaults[msg.sender];

        uint256 newDebt = add(vault.dTokenDebt, _amount);

        require(
            vault.collateral >= newDebt,
            "Cannot mint more than col balance"
        );
        vault.dTokenDebt = newDebt;

        DToken dTokenContract = DToken(dToken());
        dTokenContract.mint(_recipient, _amount);
        emit Minted(msg.sender, _amount);
    }

    /**
     * @notice Deposits collateral and mints dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     */
    function depositAndMint(uint256 _collateral, uint256 _dToken)
        external
        override
        nonReentrant
    {
        depositInternal(_collateral);
        mintInternal(msg.sender, _dToken);
    }

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
    ) external override nonReentrant {
        depositInternal(_collateral);

        // mint the tokens and set the instrument as the recipient of the newly minted tokens
        // this avoids an extra approval to the Balancer pool for the seller
        mintInternal(address(this), _dToken);

        Balancer.sellToPool(_dToken, _maxSlippage);
    }

    /**
     * @notice Repays dToken debt in a vault
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebt(address _account, uint256 _amount)
        public
        override
        nonReentrant
    {
        repayDebtInternal(msg.sender, _account, _amount);
    }

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
    ) internal {
        // Only vault owner can repay debt
        require(msg.sender == _account, "Only vault owner can repay debt");

        Vault storage vault = vaults[_account];
        require(
            vault.dTokenDebt >= _amount,
            "Cannot repay more debt than exists"
        );

        vault.dTokenDebt = sub(vault.dTokenDebt, _amount);

        DToken dTokenContract = DToken(dToken());
        dTokenContract.burn(_repayer, _amount);
        emit Repaid(_repayer, _account, _amount);
    }

    /**
     * @notice Changes `expired` to True if timestamp is greater than expiry
     * It calculates the `settlePrice` with the current prices of target and
     * collateral assets, then sets them in stone.
     */
    function settle() public override {
        require(block.timestamp > expiry, "Instrument has not expired");
        expired = true;

        // Set settlePrice to the current price of target and collat assets
        DataProviderInterface data = DataProviderInterface(dataProvider);
        settlePrice = data.getPrice(collateralAsset);

        emit Settled(block.timestamp, settlePrice);
    }

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint256 _dTokenAmount) external override nonReentrant {
        require(expired, "Instrument must be expired");

        // Padding to convert prices (10^7) to 10^18
        uint256 settlePriceWAD = mul(settlePrice, 10**11);
        uint256 strikePriceWAD = mul(strikePrice, 10**11);

        uint256 withdrawAmount;
        if (settlePrice < strikePrice) {
            withdrawAmount = _dTokenAmount;
        } else {
            uint256 price = wdiv(strikePriceWAD, settlePriceWAD);
            withdrawAmount = wmul(_dTokenAmount, price);
        }

        DToken dTokenContract = DToken(dToken());
        dTokenContract.burn(msg.sender, _dTokenAmount);

        IERC20 colTokenContract = IERC20(collateralAsset);
        colTokenContract.safeTransfer(msg.sender, withdrawAmount);

        emit Redeemed(msg.sender, _dTokenAmount, withdrawAmount);
    }

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawAfterExpiry() external override nonReentrant {
        require(expired, "Instrument must be expired");
        Vault storage vault = vaults[msg.sender];

        require(vault.collateral > 0, "Vault must have collateral");
        // Padding to convert prices (10^7) to 10^18
        uint256 settlePriceWAD = mul(settlePrice, 10**11);
        uint256 strikePriceWAD = mul(strikePrice, 10**11);

        uint256 withdrawAmount;
        if (settlePrice < strikePrice) {
            // Vault owner cannot withdraw excess collateral if settle < strike
            withdrawAmount = 0;
        } else {
            uint256 price = wdiv(strikePriceWAD, settlePriceWAD);
            // Max amount that can be redeemed against this vault
            uint256 maxRedeem = wmul(vault.dTokenDebt, price);
            // WithdrawAmount is col - maxRedeem
            withdrawAmount = sub(vault.collateral, maxRedeem);
        }

        // Reset vaults to 0 so subsequent withdraws will fail
        vault.collateral = 0;
        vault.dTokenDebt = 0;

        IERC20 colToken = IERC20(collateralAsset);
        colToken.safeTransfer(msg.sender, withdrawAmount);
        emit WithdrewExpired(msg.sender, withdrawAmount);
    }
}
