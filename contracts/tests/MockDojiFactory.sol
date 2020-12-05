// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../DojiFactory.sol";

contract MockDojiFactory is DojiFactory {
    function setInstrument(address instrument) public {
        isInstrument[instrument] = true;
    }
}
