// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import {IRibbonFactory} from "../interfaces/IRibbonFactory.sol";

library AdapterStorageTypes {
    struct CharmOptionType {
        bool isLongToken;
        uint256 strikeIndex;
    }
}

contract AdapterStorageV1 {
    mapping(bytes32 => address) internal _idToAddress;
    mapping(address => AdapterStorageTypes.CharmOptionType)
        internal _addressToOptionType;
    mapping(address => bool) internal _seenMarket;
}

contract AdapterStorage is Initializable, AdapterStorageV1 {
    IRibbonFactory public immutable factory;

    constructor(address _factory) {
        require(_factory != address(0), "!_factory");
        factory = IRibbonFactory(_factory);
    }

    function initialize() external initializer {}

    function setIdToAddress(bytes32 id, address option)
        external
        onlyInstrument
    {
        _idToAddress[id] = option;
    }

    function setAddressToOptionType(
        address option,
        AdapterStorageTypes.CharmOptionType calldata optionType
    ) external onlyInstrument {
        _addressToOptionType[option] = optionType;
    }

    function setSeenMarket(address optionMarket, bool seen)
        external
        onlyInstrument
    {
        _seenMarket[optionMarket] = seen;
    }

    function idToAddress(bytes32 id) external view returns (address) {
        return _idToAddress[id];
    }

    function addressToOptionType(address option)
        external
        view
        returns (AdapterStorageTypes.CharmOptionType memory)
    {
        return _addressToOptionType[option];
    }

    function seenMarket(address optionMarket) external view returns (bool) {
        return _seenMarket[optionMarket];
    }

    modifier onlyInstrument {
        require(factory.isInstrument(msg.sender), "!instrument");
        _;
    }
}
