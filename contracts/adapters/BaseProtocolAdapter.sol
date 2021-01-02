// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {IDojiFactory} from "../interfaces/IDojiFactory.sol";
import {Initializable} from "../lib/upgrades/Initializable.sol";

contract BaseProtocolAdapterStorage {
    address public owner;
    address public dojiFactory;

    mapping(address => uint256) public totalOptions;

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

contract BaseProtocolAdapter is Initializable, BaseProtocolAdapterStorage {}
