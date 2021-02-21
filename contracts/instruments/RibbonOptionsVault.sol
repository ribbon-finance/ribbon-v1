// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {OptionTerms, IProtocolAdapter} from "../adapters/IProtocolAdapter.sol";
import {ProtocolAdapter} from "../adapters/ProtocolAdapter.sol";
import {GammaAdapter} from "../adapters/GammaAdapter.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";
import {Ownable} from "../lib/Ownable.sol";
import {OptionsVaultStorageV1} from "../storage/OptionsVaultStorage.sol";

contract RibbonOptionsVault is OptionsVaultStorageV1 {
    using ProtocolAdapter for IProtocolAdapter;

    string private constant adapterName = "OPYN_GAMMA";

    function initialize(address _owner, address _factory) public initializer {
        Ownable.initialize(_owner);
        factory = IRibbonFactory(_factory);
    }

    function writeOptions(OptionTerms memory optionTerms) public {
        IProtocolAdapter adapter =
            IProtocolAdapter(factory.getAdapter(adapterName));

        adapter.delegateCreateShort(optionTerms, 1 ether);
    }
}
