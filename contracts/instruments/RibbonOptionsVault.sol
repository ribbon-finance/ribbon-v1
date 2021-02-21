// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {OptionTerms, IProtocolAdapter} from "../adapters/IProtocolAdapter.sol";
import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import {GammaAdapter} from "../adapters/GammaAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {Ownable} from "../lib/Ownable.sol";
import {VaultToken} from "./VaultToken.sol";
import {OptionsVaultStorageV1} from "../storage/OptionsVaultStorage.sol";

contract RibbonOptionsVault is VaultToken, OptionsVaultStorageV1 {
    using ProtocolAdapter for IProtocolAdapter;

    string private constant _adapterName = "OPYN_GAMMA";
    address private constant _WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    address public constant asset = _WETH;
    IRibbonFactory public ribbonFactory =
        IRibbonFactory(0x863dd8Ea9B7472c54CdE1F0e2D5B2bCC8CBf0Cd1);

    constructor() VaultToken("VaultToken", "VLT") {}

    function initialize(address _owner, address _factory) public initializer {
        Ownable.initialize(_owner);
        factory = IRibbonFactory(_factory);
    }

    function deposit() public payable {
        require(msg.value > 0, "No value passed");
        IWETH weth = IWETH(_WETH);
        weth.deposit{value: msg.value}();
    }

    function writeOptions(OptionTerms memory optionTerms) public {
        IProtocolAdapter adapter =
            IProtocolAdapter(ribbonFactory.getAdapter(_adapterName));

        adapter.delegateCreateShort(optionTerms, this.totalSupply());
    }
}
