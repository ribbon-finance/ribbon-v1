// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

import {IAmmAdapter} from "./IAmmAdapter.sol";

/**
 * @notice ProtocolAdapter is used to shadow IProtocolAdapter to provide functions that delegatecall's the underl
ying IProtocolAdapter functions.
 */
library AmmAdapter {

    function delegateBuyLp(IAmmAdapter adapter, uint256 amt, uint256 tradeAmt, uint256 minWbtcAmtOut, uint256 minDiggAmtOut) external {
        (bool success, bytes memory result) =
            address(adapter).delegatecall(
                abi.encodeWithSignature(
                    "buyLp(uint256,uint256,uint256,uint256)",
                 amt, tradeAmt, minWbtcAmtOut, minDiggAmtOut
                )
            );
        revertWhenFail(success, result);
    }

    function revertWhenFail(bool success, bytes memory returnData)
        private
        pure
    {
        if (success) return;
        revert(getRevertMsg(returnData));
    }

    function getRevertMsg(bytes memory _returnData)
        private
// SPDX-License-Identifier: MIT
        pure
// SPDX-License-Identifier: MIT
        returns (string memory)
    {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "ProtocolAdapter: reverted";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}