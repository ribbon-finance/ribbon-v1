// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./DToken.sol";

contract Instrument is ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public name;
    string public symbol;
    uint public expiry;
    uint public collateralizationRatio;
    address public collateralAsset;
    address public targetAsset;
    address public dToken;

    constructor(
        string memory _name,
        string memory _symbol,
        uint _expiry,
        uint _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset,
        address _dToken
    ) public {
        name = _name;
        symbol = _symbol;
        expiry = _expiry;
        collateralizationRatio = _collateralizationRatio;
        collateralAsset = _collateralAsset;
        targetAsset = _targetAsset;
        dToken = _dToken;
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
        DToken dTokenContract = DToken(dToken);
      
        dTokenContract.mint(msg.sender, _amount);
    }
}

