// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {DSMath} from "../lib/DSMath.sol";

import {OptionTerms, IProtocolAdapter} from "../adapters/IProtocolAdapter.sol";
import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {ISwap} from "../interfaces/ISwap.sol";
import {OtokenInterface} from "../interfaces/GammaInterface.sol";
import {Ownable} from "../lib/Ownable.sol";

import {OptionsVaultStorageV1} from "../storage/OptionsVaultStorage.sol";

contract RibbonETHCoveredCall is DSMath, ERC20, OptionsVaultStorageV1 {
    using ProtocolAdapter for IProtocolAdapter;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    enum ExchangeMechanism {Unknown, AirSwap}
    string private constant _tokenName = "Ribbon ETH Covered Call Vault";
    string private constant _tokenSymbol = "rETH-COVCALL";
    string private constant _adapterName = "OPYN_GAMMA";
    address private constant _WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // AirSwap Swap contract https://github.com/airswap/airswap-protocols/blob/master/source/swap/contracts/interfaces/ISwap.sol
    ISwap private constant _swapContract =
        ISwap(0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA);

    address public constant asset = _WETH;
    ExchangeMechanism public constant exchangeMechanism =
        ExchangeMechanism.AirSwap;

    // 1% for an instant withdrawal
    uint256 public constant instantWithdrawalFee = 0.01 ether;

    // 90% locked in options protocol, 10% of the pool reserved for withdrawals
    uint256 public constant lockedRatio = 0.9 ether;

    event ManagerChanged(address oldManager, address newManager);

    event Deposit(address indexed account, uint256 amount, uint256 share);

    event Withdraw(address indexed account, uint256 amount, uint256 share);

    event OpenShort(
        address indexed options,
        uint256 depositAmount,
        address manager
    );

    event CloseShort(
        address indexed options,
        uint256 withdrawAmount,
        address manager
    );

    constructor() ERC20(_tokenName, _tokenSymbol) {}

    /**
     * @notice Initializes the OptionVault contract with an owner and a factory.
     * @param _owner is the owner of the contract who can set the manager
     * @param _factory is the RibbonFactory instance
     */
    function initialize(address _owner, address _factory) public initializer {
        Ownable.initialize(_owner);
        factory = IRibbonFactory(_factory);
    }

    /**
     * @notice Sets the new manager of the vault. Revoke the airswap signer authorization from the old manager, and authorize the manager.
     * @param _manager is the new manager of the vault
     */
    function setManager(address _manager) public onlyOwner {
        require(_manager != address(0), "New manager cannot be 0x0");
        address oldManager = manager;
        if (oldManager != address(0)) {
            _swapContract.revokeSigner(oldManager);
        }
        manager = _manager;
        _swapContract.authorizeSigner(_manager);

        emit ManagerChanged(oldManager, _manager);
    }

    /**
     * @notice Deposits ETH into the contract and mint vault shares.
     */
    function depositETH() external payable nonReentrant {
        require(msg.value > 0, "No value passed");
        require(asset == _WETH, "Asset is not WETH");

        IWETH(_WETH).deposit{value: msg.value}();
        _deposit(msg.value);
    }

    /**
     * @notice Deposits the `asset` into the contract and mint vault shares.
     * @param amount is the amount of `asset` to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _deposit(amount);
    }

    /**
     * @notice Mints the vault shares to the msg.sender
     * @param amount is the amount of `asset` deposited
     */
    function _deposit(uint256 amount) private {
        // amount needs to be subtracted from totalBalance because it has already been
        // added to it from either IWETH.deposit and IERC20.safeTransferFrom
        uint256 total = totalBalance().sub(amount);

        // Following the pool share calculation from Alpha Homora: https://github.com/AlphaFinanceLab/alphahomora/blob/340653c8ac1e9b4f23d5b81e61307bf7d02a26e8/contracts/5/Bank.sol#L104
        uint256 share =
            total == 0 ? amount : amount.mul(totalSupply()).div(total);
        _mint(msg.sender, share);
        emit Deposit(msg.sender, amount, share);
    }

    /**
     * @notice Withdraws ETH from vault using vault shares
     * @param share is the number of vault shares to be burned
     */
    function withdrawETH(uint256 share) external nonReentrant {
        uint256 withdrawAmount = _withdraw(share);

        IWETH(_WETH).withdraw(withdrawAmount);
        (bool success, ) = msg.sender.call{value: withdrawAmount}("");
        require(success, "ETH transfer failed");
    }

    /**
     * @notice Withdraws WETH from vault using vault shares
     * @param share is the number of vault shares to be burned
     */
    function withdraw(uint256 share) external nonReentrant {
        uint256 withdrawAmount = _withdraw(share);
        require(
            IERC20(asset).transfer(msg.sender, withdrawAmount),
            "ERC20 transfer failed"
        );
    }

    /**
     * @notice Burns vault shares and checks if eligible for withdrawal
     * @param share is the number of vault shares to be burned
     */
    function _withdraw(uint256 share) private returns (uint256) {
        uint256 _lockedAmount = lockedAmount;
        uint256 currentAssetBalance = IERC20(asset).balanceOf(address(this));
        uint256 total = _lockedAmount.add(currentAssetBalance);
        uint256 availableForWithdrawal =
            _availableToWithdraw(_lockedAmount, currentAssetBalance);

        // Following the pool share calculation from Alpha Homora: https://github.com/AlphaFinanceLab/alphahomora/blob/340653c8ac1e9b4f23d5b81e61307bf7d02a26e8/contracts/5/Bank.sol#L111
        uint256 withdrawAmount = share.mul(total).div(totalSupply());
        require(
            withdrawAmount <= availableForWithdrawal,
            "Cannot withdraw more than available"
        );

        uint256 feeAmount = wmul(withdrawAmount, instantWithdrawalFee);
        uint256 amountAfterFee = withdrawAmount.sub(feeAmount);

        _burn(msg.sender, share);

        emit Withdraw(msg.sender, amountAfterFee, share);

        return amountAfterFee;
    }

    /**
     * @notice Rolls from one short option position to another. Closes the expired short position, withdraw from it, then open a new position.
     * @param optionTerms are the option contract terms the vault will be short
     */
    function rollToNextOption(OptionTerms calldata optionTerms)
        external
        onlyManager
        nonReentrant
    {
        // We can save gas by storing the factory address as a constant
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter(_adapterName));

        address oldOption = currentOption;
        if (oldOption != address(0)) {
            require(
                block.timestamp >= OtokenInterface(oldOption).expiryTimestamp(),
                "Otoken not expired"
            );
            uint256 withdrawAmount = adapter.delegateCloseShort();
            emit CloseShort(oldOption, withdrawAmount, msg.sender);
        }

        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        uint256 shortAmount = wmul(currentBalance, lockedRatio);
        uint256 shortBalance =
            adapter.delegateCreateShort(optionTerms, shortAmount);

        address newOption = adapter.getOptionsAddress(optionTerms);
        IERC20 optionToken = IERC20(newOption);
        optionToken.approve(address(_swapContract), shortBalance);

        currentOption = newOption;
        lockedAmount = shortAmount;

        emit OpenShort(newOption, shortAmount, msg.sender);
    }

    /**
     * @notice Returns the expiry of the current option the vault is shorting
     */
    function currentOptionExpiry() external view returns (uint256) {
        address _currentOption = currentOption;
        if (_currentOption == address(0)) {
            return 0;
        }

        OtokenInterface oToken = OtokenInterface(currentOption);
        return oToken.expiryTimestamp();
    }

    /**
     * @notice Returns the vault's total balance, including the amounts locked into a short position
     */
    function totalBalance() public view returns (uint256) {
        return lockedAmount.add(IERC20(asset).balanceOf(address(this)));
    }

    /**
     * @notice Returns the amount available for users to withdraw. MIN(10% * (locked + assetBalance), assetBalance)
     */
    function availableToWithdraw() external view returns (uint256) {
        return
            _availableToWithdraw(
                lockedAmount,
                IERC20(asset).balanceOf(address(this))
            );
    }

    /**
     * @notice Helper function that returns amount available to withdraw. Used to save gas.
     */
    function _availableToWithdraw(uint256 lockedBalance, uint256 freeBalance)
        private
        pure
        returns (uint256)
    {
        uint256 total = lockedBalance.add(freeBalance);
        uint256 reserveRatio = uint256(1 ether).sub(lockedRatio);
        uint256 reserve = wmul(total, reserveRatio);

        return min(reserve, freeBalance);
    }

    /**
     * @notice Returns the token name
     */
    function name() public pure override returns (string memory) {
        return _tokenName;
    }

    /**
     * @notice Returns the token symbol
     */
    function symbol() public pure override returns (string memory) {
        return _tokenSymbol;
    }

    /**
     * @notice Only allows manager to execute a function
     */
    modifier onlyManager {
        require(msg.sender == manager, "Only manager");
        _;
    }
}