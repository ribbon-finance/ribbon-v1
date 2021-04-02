// SPDX-License-Identifier: MIT
pragma solidity >=0.7.2;
pragma experimental ABIEncoderV2;

interface IAmmAdapter {
    function protocolName() external pure returns (string memory);

    function nonFungible() external pure returns (bool);

    function expectedWbtcOut(uint256 ethAmt) external view returns (uint256);

    function expectedDiggOut(uint256 wbtcAmt)
        external
        view
        returns (uint256 diggOut, uint256 tradeAmt);

    function buyLp(
        uint256 amt,
        uint256 tradeAmt,
        uint256 minWbtcAmtOut,
        uint256 minDiggAmtOut
    ) external payable;
}
