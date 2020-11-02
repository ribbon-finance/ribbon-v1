// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./MockBPool.sol";

contract MockBFactory {
    function newBPool() external returns (address) {
        MockBPool pool = new MockBPool();
        return address(pool);
    }
}
