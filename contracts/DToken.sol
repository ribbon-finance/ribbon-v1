// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DToken is ERC20 {
    address public owner;
    
    constructor(
        string memory _name,
        string memory _symbol
    ) public ERC20(_name, _symbol) {
        owner = msg.sender;
    }

    function setInstrumentAsOwner(address _add) public {
        require(msg.sender == owner, "caller is not the owner");
        owner = _add;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == owner, "caller is not the owner");
        _mint(to, amount);
    }
}