// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./lib/DSMath.sol";
import "./interfaces/BalancerInterface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Balancer is DSMath {
    address private _dToken;
    address private _paymentToken;
    BalancerPool private _balancerPool;
    uint256 private _maxSlippage;

    function initialize(
        address bFactory,
        address dToken,
        address paymentToken,
        uint256 maxSlippage
    ) public {
        _dToken = dToken;
        _paymentToken = paymentToken;
        _balancerPool = newPool(bFactory, dToken, paymentToken);
        _maxSlippage = maxSlippage;
    }

    function newPool(
        address bFactory,
        address dToken,
        address paymentToken
    ) private returns (BalancerPool) {
        BalancerFactory balancerFactory = BalancerFactory(bFactory);
        BalancerPool pool = balancerFactory.newBPool();

        // We need to set the weights for dToken and paymentToken to be equal i.e. 50/50
        // https://docs.balancer.finance/protocol/concepts#terminology
        pool.bind(dToken, 0, 1);
        pool.bind(paymentToken, 0, 1);
        pool.finalize();

        return pool;
    }

    function sellToPool(uint256 _sellAmount)
        public
        returns (uint256 tokenAmountOut, uint256 spotPriceAfter)
    {
        address dToken = _dToken;
        address paymentToken = _paymentToken;
        uint256 spot = _balancerPool.getSpotPrice(dToken, _paymentToken);
        uint256 maxPrice = wmul(spot, add(1 ether, _maxSlippage));
        uint256 minAmountOut = wdiv(_sellAmount, maxPrice);

        // we need to approve the transfer beforehand
        IERC20 tokenIn = IERC20(dToken);
        IERC20 tokenOut = IERC20(paymentToken);
        tokenIn.approve(address(_balancerPool), _sellAmount);

        (tokenAmountOut, spotPriceAfter) = _balancerPool.swapExactAmountIn(
            _dToken,
            _sellAmount,
            paymentToken,
            minAmountOut,
            maxPrice
        );

        // After the swap is complete, we need to transfer the swapped tokens back to the msg.sender
        require(
            tokenOut.transfer(msg.sender, tokenAmountOut),
            "Token out transfer fail"
        );
    }

    // GETTERS
    function balancerDToken() public view returns (address) {
        return _dToken;
    }

    function balancerPaymentToken() public view returns (address) {
        return _paymentToken;
    }

    function balancerPool() public view returns (address) {
        return address(_balancerPool);
    }

    function balancerMaxSlippage() public view returns (uint256) {
        return _maxSlippage;
    }
}
