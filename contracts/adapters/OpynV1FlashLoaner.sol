// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0;

import {FlashLoanReceiverBase} from "../lib/aave/FlashLoanReceiverBase.sol";
import {
    ILendingPool,
    ILendingPoolAddressesProvider
} from "../lib/aave/Interfaces.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    IOToken,
    IOptionsExchange,
    IUniswapFactory,
    UniswapExchangeInterface
} from "../interfaces/OpynV1Interface.sol";
import {IUniswapV2Router02} from "../interfaces/IUniswapV2Router.sol";

contract OpynV1FlashLoaner is FlashLoanReceiverBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant _vaultStartIteration = 0;
    uint256 private constant _maxVaultIterations = 5;
    uint256 private constant _swapWindow = 900;
    address internal _uniswapRouter;
    address internal _weth;

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
        // 1. Call underlyingrequiredtoexercise to get usdc amount
        // 2. Approve OptionsContract on underlying token with that amount
        // 3. call exercise
        // 4. Verify that we have received the collateral
        // 5. Swap the fee amount to underlying using the collateral
        // 6. Leftover collateral used as profit

        address underlying = assets[0];
        uint256 underlyingAmount = amounts[0];

        (address oToken, uint256 exerciseAmount) = abi.decode(
            params,
            (address, uint256)
        );

        exercisePostLoan(underlying, oToken, exerciseAmount);

        swapForUnderlying(underlying, oToken, underlyingAmount + premiums[0]);

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.
        // Approve the LendingPool contract allowance to *pull* the owed amount
        approveUnderlying(
            underlying,
            address(_lendingPool),
            underlyingAmount + premiums[0]
        );

        return true;
    }

    function exercisePostLoan(
        address underlying,
        address oToken,
        uint256 exerciseAmount
    ) private {
        IOToken oTokenContract = IOToken(oToken);

        approveUnderlying(underlying, oToken, exerciseAmount);

        address payable[] memory vaults = getVaults(oTokenContract);
        oTokenContract.exercise(exerciseAmount, vaults);
    }

    function swapForUnderlying(
        address underlying,
        address oToken,
        uint256 underlyingAmount
    ) private {
        IOToken oTokenContract = IOToken(oToken);

        address collateral = oTokenContract.collateral();
        IUniswapV2Router02 router = IUniswapV2Router02(_uniswapRouter);

        if (collateral == address(0)) {
            address[] memory path = new address[](2);
            path[0] = _weth;
            path[1] = underlying;

            uint256[] memory amountsIn = router.getAmountsIn(
                underlyingAmount,
                path
            );
            uint256 maxCollateralAmount = amountsIn[0];

            router.swapETHForExactTokens{value: maxCollateralAmount}(
                underlyingAmount,
                path,
                address(this),
                block.timestamp + _swapWindow
            );
        } else {
            address[] memory path = new address[](3);
            path[0] = collateral;
            path[1] = _weth;
            path[2] = underlying;
            IERC20 collateralToken = IERC20(collateral);
            uint256[] memory amountsIn = router.getAmountsIn(
                underlyingAmount,
                path
            );
            uint256 maxCollateralAmount = amountsIn[0];

            collateralToken.safeApprove(address(router), maxCollateralAmount);

            router.swapTokensForExactTokens(
                underlyingAmount,
                maxCollateralAmount,
                path,
                address(this),
                block.timestamp + _swapWindow
            );
        }
    }

    function exerciseOTokens(address oToken, uint256 exerciseAmount) public {
        address receiverAddress = address(this);

        IOToken oTokenContract = IOToken(oToken);
        uint256 underlyingAmount = oTokenContract.underlyingRequiredToExercise(
            exerciseAmount
        );

        address[] memory assets = new address[](1);
        assets[0] = oTokenContract.underlying();

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = underlyingAmount;

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

    function approveUnderlying(
        address underlying,
        address spender,
        uint256 approveAmount
    ) private {
        IERC20 underlyingToken = IERC20(underlying);
        require(
            underlyingToken.balanceOf(address(this)) >= approveAmount,
            "Not enough underlying to approve"
        );
        underlyingToken.safeApprove(spender, approveAmount);
    }

    function getVaults(IOToken oTokenContract)
        public
        returns (address payable[] memory vaults)
    {
        vaults = new address payable[](_maxVaultIterations);
        uint256 currentVaultIndex = 0;
        for (
            uint256 v = _vaultStartIteration;
            v < _vaultStartIteration + _maxVaultIterations;
            v++
        ) {
            address payable vault = oTokenContract.vaultOwners(v);
            if (vault != address(0)) {
                vaults[currentVaultIndex] = vault;
                currentVaultIndex++;
            }
        }
    }
}
