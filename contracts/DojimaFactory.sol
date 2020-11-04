// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "./lib/upgrades/Initializable.sol";
import "./lib/upgrades/AdminUpgradeabilityProxy.sol";
import "./interfaces/InstrumentInterface.sol";
import "./DojimaFactoryStorage.sol";

contract DojimaFactory is Initializable, DojimaFactoryStorageV1 {
    /**
     * @notice Emitted when a new instrument is created
     */
    event InstrumentCreated(
        string name,
        address instrumentAddress,
        address dTokenAddress
    );

    /**
     * @notice Emitted when a new instrument is created
     */
    event ProxyCreated(address logic, address proxyAddress, bytes initData);

    /**
     * @notice Constructor takes a DataProvider contract address
     */
    function initialize(
        address _owner,
        address _dataProvider,
        address _instrumentAdmin,
        address _liquidatorProxy
    ) public initializer {
        owner = _owner;
        dataProvider = _dataProvider;
        liquidatorProxy = _liquidatorProxy;
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
        string memory name = instrument.name();
        require(instruments[name] == address(0), "Instrument already exists");

        instruments[name] = instrumentAddress;
        emit InstrumentCreated(name, instrumentAddress, instrument.dToken());
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
