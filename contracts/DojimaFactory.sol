// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/upgrades/Initializable.sol";
import "./DojimaInstrument.sol";
import "./DojimaFactoryStorage.sol";

contract DojimaFactory is Initializable, Ownable, DojimaFactoryStorageV1 {
    /**
     * @notice Emitted when a new instrument is created
     */
    event InstrumentCreated(
        string name,
        address instrumentAddress,
        address dTokenAddress
    );

    /**
     * @notice Constructor takes a DataProvider contract address
     */
    function initialize(address _dataProvider) public initializer {
        dataProvider = _dataProvider;
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

    /**
     * @notice Creates a new instrument from the factory
     */
    function newInstrument(
        string memory _name,
        string memory _symbol,
        uint256 _expiry,
        uint256 _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset,
        address _liquidatorProxy
    ) public returns (address instrumentAddress) {
        require(instruments[_name] == address(0), "Instrument already exists");

        DojimaInstrument instrument = new DojimaInstrument(
            dataProvider,
            _name,
            _symbol,
            _expiry,
            _collateralizationRatio,
            _collateralAsset,
            _targetAsset,
            _liquidatorProxy
        );
        instruments[_name] = address(instrument);
        emit InstrumentCreated(_name, address(instrument), instrument.dToken());

        instrumentAddress = address(instrument);
    } 
}
