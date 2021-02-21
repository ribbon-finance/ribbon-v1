// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract VaultToken is ERC20 {
    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
