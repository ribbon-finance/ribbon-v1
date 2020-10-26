// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./BaseInstrument.sol";

contract DualCurrency is BaseInstrument {
    using SafeERC20 for IERC20;

    constructor(
        address _dataProvider,
        string memory name,
        string memory _symbol,
        uint256 _expiry,
        uint256 _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset,
        address _liquidatorProxy
    ) public {
        require(block.timestamp < _expiry, "Expiry has already passed");

        _name = name;
        symbol = _symbol;
        expiry = _expiry;
        collateralizationRatio = _collateralizationRatio;
        collateralAsset = _collateralAsset;
        targetAsset = _targetAsset;
        dataProvider = _dataProvider;
        liquidatorProxy = _liquidatorProxy;

        // Init new DToken
        DToken newDToken = new DToken(_name, symbol);
        _dToken = address(newDToken);

        expired = false;
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
        uint256 targetAssetPrice = data.getPrice(targetAsset);
        uint256 collateralAssetPrice = data.getPrice(collateralAsset);

        settlePrice = computeSettlePrice(
            targetAssetPrice,
            collateralAssetPrice
        );

        emit Settled(
            block.timestamp,
            settlePrice,
            targetAssetPrice,
            collateralAssetPrice
        );
    }

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawAfterExpiry() external override nonReentrant {
        require(expired, "Instrument must be expired");
        Vault storage vault = vaults[msg.sender];

        uint256 withdrawableColAmount = wmul(settlePrice, vault.dTokenDebt);
        vault.collateral = sub(vault.collateral, withdrawableColAmount);
        IERC20 colToken = IERC20(collateralAsset);
        colToken.safeTransfer(msg.sender, withdrawableColAmount);
        emit WithdrewExpired(msg.sender, withdrawableColAmount);
    }

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint256 _dTokenAmount) external override nonReentrant {
        require(expired, "Instrument must be expired");

        uint256 withdrawableColAmount = wmul(settlePrice, _dTokenAmount);

        totalDebt = sub(totalDebt, _dTokenAmount);

        DToken dTokenContract = DToken(dToken());
        dTokenContract.burn(msg.sender, _dTokenAmount);

        IERC20 colTokenContract = IERC20(collateralAsset);
        colTokenContract.safeTransfer(msg.sender, withdrawableColAmount);

        emit Redeemed(msg.sender, _dTokenAmount, withdrawableColAmount);
    }
}
