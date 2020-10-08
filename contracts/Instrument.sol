// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./DToken.sol";
import "./DataProviderInterface.sol";
import "./lib/DSMath.sol";

contract Instrument is ReentrancyGuard, DSMath {
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

    constructor(
        address _dataProvider,
        string memory _name,
        string memory _symbol,
        uint _expiry,
        uint _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset
    ) public {
        require(block.timestamp < _expiry, "Cannot initialize instrument with expiry that has already passed");

        name = _name;
        symbol = _symbol;
        expiry = _expiry;
        collateralizationRatio = _collateralizationRatio;
        collateralAsset = _collateralAsset;
        targetAsset = _targetAsset;
        dataProvider = _dataProvider;

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
     * @notice Emitted when the instrument is settled
     */
    event Settled(
        uint timestamp,
        uint settlePrice,
        uint targetAssetPrice,
        uint collateralAssetPrice
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
     * @notice Gets the collateral and debt of a vault
     * @param _user user's address
     */
    function getVault(address _user) public view 
    returns(uint _collateral, uint _dTokenDebt) {
        Vault storage vault = vaults[_user];
        return (vault.collateral, vault.dTokenDebt);
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
        vault.collateral += _amount;
      
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
            "Collateralization ratio too low to mint"
        );
        vault.dTokenDebt = newDebt;

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

