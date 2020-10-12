// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DToken is ERC20, Ownable {
    constructor(string memory _name, string memory _symbol)
        public
        ERC20(_name, _symbol)
    {}

    /**
     * @notice Function to mint new dTokens when opening vaults
     * @param to is the recipient of the newly minted tokens
     * @param amount is the mint amount 
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Function to burn dTokens from supply during redemption and debt repayment
     * @param from is the address to burn tokens from
     * @param amount is the burn amount
     */
    function burn(address from, uint256 amount) public onlyOwner {
        require(balanceOf(from) >= amount, "Cannot burn more than account balance");
        _burn(from, amount);
    }

    /**
     * @notice Getter to return the instrument the token is tied to
     */
    function dojimaInstrument() public view returns (address) {
        // The instrument is the owner of the token
        return owner();
    }
}
