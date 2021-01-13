// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "../RibbonFactory.sol";

contract MockRibbonFactory is RibbonFactory {
    function setInstrument(address instrument) public {
        isInstrument[instrument] = true;
    }
}
