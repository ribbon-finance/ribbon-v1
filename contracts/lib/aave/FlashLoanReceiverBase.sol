// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0;

import {
    IFlashLoanReceiver,
    ILendingPoolAddressesProvider,
    ILendingPool,
    IERC20
} from "./Interfaces.sol";
import {
    SafeERC20,
    SafeMath
} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    ILendingPoolAddressesProvider internal _addressesProvider;
    ILendingPool internal _lendingPool;

    constructor(ILendingPoolAddressesProvider provider) public {
        _addressesProvider = provider;
        _lendingPool = ILendingPool(
            ILendingPoolAddressesProvider(provider).getLendingPool()
        );
    }

    receive() external payable {}
}
