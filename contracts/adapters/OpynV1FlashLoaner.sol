// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0;

import {FlashLoanReceiverBase} from "../lib/aave/FlashLoanReceiverBase.sol";
import {
    ILendingPool,
    ILendingPoolAddressesProvider,
    IERC20
} from "../lib/aave/Interfaces.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IOToken} from "../interfaces/OpynV1Interface.sol";

contract OpynV1FlashLoaner is FlashLoanReceiverBase {
    using SafeMath for uint256;

    constructor(ILendingPoolAddressesProvider _addressProvider)
        public
        FlashLoanReceiverBase(_addressProvider)
    {}

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        //
        // This contract now has the funds requested.
        // Your logic goes here.
        //

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.

        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(_lendingPool), amountOwing);
        }

        return true;
    }

    function exerciseOTokens(address oToken, uint256 exerciseAmount) public {
        address receiverAddress = address(this);

        IOToken oTokenContract = IOToken(oToken);

        address[] memory assets = new address[](1);
        assets[0] = oTokenContract.underlying();

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = exerciseAmount;

        // 0 = no debt, 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        address onBehalfOf = address(this);
        bytes memory params = abi.encode(oToken, exerciseAmount);
        uint16 referralCode = 0;

        _lendingPool.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }
}
