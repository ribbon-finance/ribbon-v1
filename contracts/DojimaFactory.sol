// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "./lib/upgrades/Initializable.sol";
import "./lib/upgrades/AdminUpgradeabilityProxy.sol";
import "./interfaces/InstrumentInterface.sol";

contract DojimaFactoryStorageV1 {
    /**
     * @notice Address of contract owner
     */
    address public owner;

    /**
     * @notice Address of the admin of all instruments
     */
    address public instrumentAdmin;

    /**
     * @notice Mapping of created instruments
     */
    mapping(string => address) public instruments;
}

contract DojimaFactory is Initializable, DojimaFactoryStorageV1 {
    /**
     * @notice Emitted when a new instrument is created
     */
    event InstrumentCreated(
        string symbol,
        address indexed instrumentAddress,
        address indexed dTokenAddress
    );

    /**
     * @notice Emitted when a new instrument is created
     */
    event ProxyCreated(
        address indexed logic,
        address indexed proxyAddress,
        bytes initData
    );

    /**
     * @notice Constructor takes a DataProvider contract address
     */
    function initialize(address _owner, address _instrumentAdmin)
        public
        initializer
    {
        owner = _owner;
        instrumentAdmin = _instrumentAdmin;
    }

    /**
     * @notice Getter for getting contract address by instrument name
     */
    function getInstrument(string memory _name)
        public
        view
        returns (address instrumentAddress)
    {
        instrumentAddress = instruments[_name];
    }

    function newInstrument(address _logic, bytes memory _initData)
        public
        returns (address instrumentAddress)
    {
        require(msg.sender == owner, "Only owner");
        instrumentAddress = createProxy(_logic, _initData);
        InstrumentStorageInterface instrument = InstrumentStorageInterface(
            instrumentAddress
        );
        string memory symbol = instrument.symbol();
        require(instruments[symbol] == address(0), "Instrument already exists");

        instruments[symbol] = instrumentAddress;
        emit InstrumentCreated(symbol, instrumentAddress, instrument.dToken());
    }

    function createProxy(address _logic, bytes memory _initData)
        private
        returns (address)
    {
        AdminUpgradeabilityProxy proxy = new AdminUpgradeabilityProxy(
            _logic,
            instrumentAdmin,
            _initData
        );
        emit ProxyCreated(_logic, address(proxy), _initData);
        return address(proxy);
    }
}
