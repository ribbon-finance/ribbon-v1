// SPDX-License-Identifier: MIT
pragma solidity 0.7.2;

// For test suite
contract ForceSend {
    function go(address payable victim) external payable {
        selfdestruct(victim);
    }
}
