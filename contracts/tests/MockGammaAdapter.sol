// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import {GammaAdapter} from "../adapters/GammaAdapter.sol";

contract MockGammaAdapter is GammaAdapter {
    constructor(address oTokenFactory, address weth)
        public
        GammaAdapter(oTokenFactory, weth)
    {}

    function initialize(address _owner) public initializer {
        owner = _owner;
    }
}
