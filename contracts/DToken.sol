// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DToken is ERC20, Ownable {
    constructor(string memory _name, string memory _symbol)
        public
        ERC20(_name, _symbol)
    {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner {
        require(balanceOf(from) >= amount, "Cannot burn more than account balance");
        _burn(from, amount);
    }
}
