// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {IDojiFactory} from "../interfaces/IDojiFactory.sol";
import {Initializable} from "../lib/upgrades/Initializable.sol";

contract BaseProtocolAdapterStorageV1 {
    address public owner;
    address public dojiFactory;

    modifier onlyOwner {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyInstrument {
        IDojiFactory factory = IDojiFactory(dojiFactory);
        bool isInstrument = factory.isInstrument(msg.sender);
        require(isInstrument, "Only instrument");
        _;
    }
}

contract BaseProtocolAdapter is Initializable, BaseProtocolAdapterStorageV1 {}
