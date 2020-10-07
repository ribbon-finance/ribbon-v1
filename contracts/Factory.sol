// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "./Instrument.sol";
import "./DToken.sol";

contract Factory {
    /**
     * @notice Address of dataProvider contract
     */
    address public dataProvider;

    /**
     * @notice Constructor takes a DataProvider contract address
     */
    constructor(address _dataProvider) public {
        dataProvider = _dataProvider;
    }

    /**
     * @notice Mapping of created instruments
     */
    mapping(string => address) public instruments;

    /**
     * @notice Emitted when a new instrument is created
     */
    event InstrumentCreated(
        string name,
        address instrumentAddress,
        address dTokenAddress
    );

    /**
     * @notice Getter for getting contract address by instrument name
     */
    function getInstrument(string memory _name) 
    public view returns(address instrumentAddress) {
        instrumentAddress = instruments[_name];
    }

    /**
     * @notice Creates a new instrument from the factory
     */
    function newInstrument(
        string memory _name,
        string memory _symbol,
        uint _expiry,
        uint _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset
    ) public returns(address instrumentAddress) {
        require(instruments[_name] == address(0), "Instrument already exists");

        DToken dToken = new DToken(
            _name,
            _symbol
        );

        Instrument instrument = new Instrument(
            dataProvider,
            _name,
            _symbol,
            _expiry,
            _collateralizationRatio,
            _collateralAsset,
            _targetAsset,
            address(dToken)
        );

        dToken.setInstrumentAsOwner(address(instrument));
        instruments[_name] = address(instrument);   
        emit InstrumentCreated(
            _name,
            address(instrument),
            address(dToken)
        );
        
        instrumentAddress = address(instrument);
    }
}