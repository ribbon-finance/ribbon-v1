// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

interface IDojiFactory {
    function isInstrument(address instrument) external returns (bool);

    function adapters(string calldata protocolName) external returns (address);
}
