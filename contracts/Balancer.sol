// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./interfaces/BalancerInterface.sol";

contract Balancer {
    address private _dToken;
    address private _paymentToken;
    address private _balancerPool;

    function initialize(
        address bFactory,
        address dToken,
        address paymentToken
    ) public {
        _dToken = dToken;
        _paymentToken = paymentToken;
        _balancerPool = newPool(bFactory, dToken, paymentToken);
    }

    function newPool(
        address bFactory,
        address dToken,
        address paymentToken
    ) private returns (address) {
        BalancerFactory balancerFactory = BalancerFactory(bFactory);
        BalancerPool pool = BalancerPool(balancerFactory.newBPool());

        // We need to set the weights for dToken and paymentToken to be equal i.e. 50/50
        // https://docs.balancer.finance/protocol/concepts#terminology
        pool.bind(dToken, 0, 1);
        pool.bind(paymentToken, 0, 1);

        return address(pool);
    }

    // GETTERS
    function balancerDToken() public view returns (address) {
        return _dToken;
    }

    function balancerPaymentToken() public view returns (address) {
        return _paymentToken;
    }

    function balancerPool() public view returns (address) {
        return _balancerPool;
    }
}
