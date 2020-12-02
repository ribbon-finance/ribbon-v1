// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./ProtocolAdapter.sol";

contract HegicAdapter is ProtocolAdapter {
    string private constant _name = "HEGIC";
    bool private constant _nonFungible = true;

    function protocolName() external override pure returns (string memory) {
        return _name;
    }

    function nonFungible() external override pure returns (bool) {
        return _nonFungible;
    }

    function premium(
        address underlying,
        address strikeAsset,
        address collateral,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 purchaseAmount
    ) public override view returns (uint256 cost) {
        return 0;
    }

    function exerciseProfit(
        address underlying,
        address strikeAsset,
        address collateral,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 exerciseAmount
    ) public override view returns (uint256 profit) {
        return 0;
    }

    function purchase(uint256 amount) external override payable {}

    function exercise(uint256 amount, uint256 optionID)
        external
        override
        payable
    {}
}
