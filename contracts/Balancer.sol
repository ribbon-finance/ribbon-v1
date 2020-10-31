// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./lib/DSMath.sol";
import "./interfaces/BalancerInterface.sol";

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
        uint256 spot = _balancerPool.getSpotPrice(_dToken, _paymentToken);
        uint256 maxPrice = wmul(spot, add(1 ether, _maxSlippage));
        uint256 minAmountOut = wdiv(spot, maxPrice);
        (tokenAmountOut, spotPriceAfter) = _balancerPool.swapExactAmountIn(
            _dToken,
            _sellAmount,
            _paymentToken,
            minAmountOut,
            maxPrice
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
}
