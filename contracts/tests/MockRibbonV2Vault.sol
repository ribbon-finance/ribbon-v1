pragma solidity >=0.7.2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockRibbonV2Vault {
    using SafeERC20 for IERC20;
    address public asset;

    constructor(address token) {
        asset = token;
    }

    function depositFor(uint256 amount, address creditor) external {
        require(amount > 0, "!amount");
        require(creditor != address(0));

        // skip actual deposit logic here

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
    }
}
