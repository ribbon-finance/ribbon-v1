// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../lib/upgrades/Initializable.sol";
import "../lib/DSMath.sol";
import "../interfaces/InstrumentInterface.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DojiVolatilityStorage.sol";

contract DojiVolatility is
    Initializable,
    InstrumentInterface,
    ReentrancyGuard,
    DSMath,
    DojiVolatilityStorageV1
{
    function initialize(
        address _owner,
        string memory name,
        string memory symbol,
        uint256 _expiry,
        uint256 _strikePrice,
        address _hegicOption
    ) public initializer {
        require(block.timestamp < _expiry, "Expiry has already passed");

        owner = _owner;
        _name = name;
        _symbol = symbol;
        expiry = _expiry;
        strikePrice = _strikePrice;
        hegicOption = _hegicOption;
    }

    /**
     * @notice Deposits collateral into the system. Calls the `depositInteral` function
     * @param _amount is amount of collateral to deposit
     */
    function deposit(uint256 _amount) public override payable nonReentrant {
        raiseNotImplemented();
        require(_amount == 0);
    }

    /**
     * @notice Mints dTokens. Calls the `mintInternal` function
     * @param _amount is amount of dToken to mint
     */
    function mint(uint256 _amount) public override nonReentrant {
        raiseNotImplemented();
        require(_amount == 0);
    }

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
    {
        raiseNotImplemented();
        require(_collateral == 0 && _dToken == 0);
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
    ) external override payable nonReentrant {
        raiseNotImplemented();
        require(_collateral == 0 && _dToken == 0 && _maxSlippage == 0);
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
        raiseNotImplemented();
        require(_account == address(0) && _amount == 0);
    }

    /**
     * @notice Changes `expired` to True if timestamp is greater than expiry
     * It calculates the `settlePrice` with the current prices of target and
     * collateral assets, then sets them in stone.
     */
    function settle() public override {
        raiseNotImplemented();
    }

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint256 _dTokenAmount) external override nonReentrant {
        raiseNotImplemented();
        require(_dTokenAmount == 0);
    }

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawAfterExpiry() external override nonReentrant {
        raiseNotImplemented();
    }

    function raiseNotImplemented() private pure {
        require(false, "Not implemented");
    }
}
