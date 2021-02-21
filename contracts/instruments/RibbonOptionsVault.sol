// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {OptionTerms, IProtocolAdapter} from "../adapters/IProtocolAdapter.sol";
import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import {GammaAdapter} from "../adapters/GammaAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {ISwap} from "../interfaces/ISwap.sol";
import {Ownable} from "../lib/Ownable.sol";
import {VaultToken} from "./VaultToken.sol";
import {OptionsVaultStorageV1} from "../storage/OptionsVaultStorage.sol";
import "hardhat/console.sol";

contract RibbonOptionsVault is VaultToken, OptionsVaultStorageV1 {
    using ProtocolAdapter for IProtocolAdapter;
    using SafeERC20 for IERC20;

    string private constant _adapterName = "OPYN_GAMMA";
    address private constant _WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    ISwap private constant _swapContract =
        ISwap(0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA);

    address public constant asset = _WETH;

    constructor() VaultToken("VaultToken", "VLT") {}

    function initialize(address _owner, address _factory) public initializer {
        Ownable.initialize(_owner);
        factory = IRibbonFactory(_factory);
    }

    function setManager(address _manager) public onlyOwner {
        require(_manager != address(0), "New manager cannot be 0x0");
        address currentManager = manager;
        if (currentManager != address(0)) {
            _swapContract.revokeSigner(currentManager);
        }

        manager = _manager;
        _swapContract.authorizeSigner(_manager);
    }

    function depositETH() public payable {
        require(msg.value > 0, "No value passed");
        require(asset == _WETH, "Asset is not WETH");

        IWETH weth = IWETH(_WETH);
        weth.deposit{value: msg.value}();
        this.mint(msg.sender, msg.value);
    }

    function deposit(uint256 amount) public {
        IERC20 assetToken = IERC20(asset);
        assetToken.safeTransferFrom(msg.sender, address(this), amount);
        this.mint(msg.sender, amount);
    }

    function writeOptions(OptionTerms memory optionTerms) public onlyManager {
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter(_adapterName));

        adapter.delegateCreateShort(optionTerms, this.totalSupply());

        address options = adapter.getOptionsAddress(optionTerms);
        currentOption = options;
    }

    function sellOptions() public {}

    modifier onlyManager {
        require(msg.sender == manager, "Only manager");
        _;
    }
}
