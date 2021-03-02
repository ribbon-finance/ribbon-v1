// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;


import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


import {
    OptionType,
    IProtocolAdapter,
    OptionTerms,
    ZeroExOrder,
    PurchaseMethod
} from "./IProtocolAdapter.sol";

import {
    ICharmOptionMarket
} from "../interfaces/CharmInterface.sol";


contract CharmAdapet is IProtocolAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;


    string private constant _name = "CHARM";
    bool private constant _nonFungible = false;


    receive() external payable {}

    function protocolName() external pure override returns (string memory) {
        return _name;
    }

    function nonFungible() external pure override returns (bool) {
        return _nonFungible;
    }

    function purchaseMethod() external pure override returns (PurchaseMethod) {
        return PurchaseMethod;
    }


    /**
     * @notice Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.
     */
    function premium(OptionTerms calldata , uint256 purchaseAmount)
        external
        pure
        override
        returns (uint256 cost)
    {
        CharmInterface charmInterface = CharmInterface(0x8Dd6231992E75CA2D160D8fA2e0b506783B50D7f);
        cost = charmInterface.getCurrentCost();
        return cost;
    }


}
