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
import {GammaAdapter} from "../adapters/GammaAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {ISwap} from "../interfaces/ISwap.sol";
import {Ownable} from "../lib/Ownable.sol";
import {OptionsVaultStorageV1} from "../storage/OptionsVaultStorage.sol";
import "hardhat/console.sol";

contract RibbonETHCoveredCall is DSMath, ERC20, OptionsVaultStorageV1 {
    using ProtocolAdapter for IProtocolAdapter;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    enum ExchangeMechanism {Unknown, AirSwap}

    string private constant _tokenName = "Ribbon ETH Covered Call Vault";
    string private constant _tokenSymbol = "rETH-COVCALL";
    string private constant _adapterName = "OPYN_GAMMA";
    address private constant _WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    ISwap private constant _swapContract =
        ISwap(0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA);

    address public constant asset = _WETH;
    ExchangeMechanism public constant exchangeMechanism =
        ExchangeMechanism.AirSwap;

    // 5 basis points for an instant withdrawal
    uint256 public constant instantWithdrawalFee = 0.0005 ether;

    // Users can withdraw for free but have to wait for 7 days
    uint256 public constant freeWithdrawPeriod = 7 days;

    // 90% locked in options protocol, 10% of the pool reserved for withdrawals
    uint256 public constant lockedRatio = 0.9 ether;

    event ManagerChanged(address oldManager, address newManager);

    event Deposited(address account, uint256 amouunt);

    event WriteOptions(address manager, address options, uint256 amount);

    event OptionsSaleApproved(
        address manager,
        address options,
        uint256 approveAmount
    );

    constructor() ERC20(_tokenName, _tokenSymbol) {}

    function initialize(address _owner, address _factory) public initializer {
        Ownable.initialize(_owner);
        factory = IRibbonFactory(_factory);
        feeTo = address(this);
    }

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

    function depositETH() external payable nonReentrant {
        require(msg.value > 0, "No value passed");
        require(asset == _WETH, "Asset is not WETH");

        IWETH weth = IWETH(_WETH);
        weth.deposit{value: msg.value}();
        _deposit(msg.value);
    }

    function deposit(uint256 amount) external nonReentrant {
        IERC20 assetToken = IERC20(asset);
        assetToken.safeTransferFrom(msg.sender, address(this), amount);
        _deposit(amount);
    }

    function _deposit(uint256 amount) private {
        uint256 total = totalBalance().sub(amount);
        uint256 share =
            total == 0 ? amount : amount.mul(totalSupply()).div(total);
        _mint(msg.sender, share);
        emit Deposited(msg.sender, share);
    }

    function withdrawETH(uint256 share) external nonReentrant {
        uint256 amount = share.mul(totalBalance()).div(totalSupply());
        uint256 feeAmount = wdiv(amount, instantWithdrawalFee);
        uint256 amountAfterFee = amount.sub(feeAmount);

        _burn(msg.sender, share);

        (bool success, ) = msg.sender.call{value: amountAfterFee}("");
        require(success, "ETH transfer failed");
    }

    function writeOptions(OptionTerms calldata optionTerms)
        external
        onlyManager
        nonReentrant
    {
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter(_adapterName));

        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        uint256 shortAmount = wmul(currentBalance, lockedRatio);
        uint256 shortBalance =
            adapter.delegateCreateShort(optionTerms, shortAmount);

        address options = adapter.getOptionsAddress(optionTerms);

        IERC20 optionToken = IERC20(options);
        optionToken.approve(address(_swapContract), shortBalance);

        currentOption = options;
        lockedAmount = shortAmount;

        emit WriteOptions(msg.sender, options, shortAmount);
    }

    function totalBalance() public view returns (uint256) {
        return lockedAmount.add(IERC20(asset).balanceOf(address(this)));
    }

    function availableToWithdraw() external view returns (uint256) {
        return
            _availableToWithdraw(
                lockedAmount,
                IERC20(asset).balanceOf(address(this))
            );
    }

    function _availableToWithdraw(uint256 lockedBalance, uint256 freeBalance)
        private
        pure
        returns (uint256)
    {
        if (lockedBalance <= freeBalance) {
            return freeBalance.sub(lockedBalance);
        }

        // add a case here for lockedBalance < freeBalance, return freeBalance
        uint256 reserve = wdiv(lockedBalance, lockedRatio);

        // console.log("supply %s, reserve %s", this.totalSupply(), reserve);
        return min(reserve, freeBalance);
    }

    function name() public pure override returns (string memory) {
        return _tokenName;
    }

    function symbol() public pure override returns (string memory) {
        return _tokenSymbol;
    }

    modifier onlyManager {
        require(msg.sender == manager, "Only manager");
        _;
    }
}
