// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

interface IDojiFactory {
    function isInstrument(address instrument) external returns (bool);

    function adapters(string memory protocolName) external returns (address);
}
