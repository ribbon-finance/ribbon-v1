// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {
    IOToken,
    IOptionsExchange,
    IUniswapFactory,
    UniswapExchangeInterface
} from "../interfaces/OpynV1.sol";
import {IProtocolAdapter, OptionType} from "./IProtocolAdapter.sol";
import {BaseProtocolAdapter} from "./BaseProtocolAdapter.sol";

contract OpynV1AdapterStorageV1 is BaseProtocolAdapter {
    mapping(bytes => address) public optionTermsToOToken;
}

contract OpynV1Adapter is
    IProtocolAdapter,
    ReentrancyGuard,
    OpynV1AdapterStorageV1
{
    using SafeMath for uint256;

    string private constant _name = "OPYN_V1";
    bool private constant _nonFungible = false;

    function protocolName() public override pure returns (string memory) {
        return _name;
    }

    function nonFungible() external override pure returns (bool) {
        return _nonFungible;
    }

    function premium(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 purchaseAmount
    ) public override view returns (uint256 cost) {
        address oToken = lookupOToken(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        UniswapExchangeInterface uniswapExchange = getUniswapExchangeFromOToken(
            oToken
        );
        cost = uniswapExchange.getEthToTokenOutputPrice(purchaseAmount);
    }

    function exerciseProfit(
        address optionsAddress,
        uint256 optionID,
        uint256 exerciseAmount
    ) public override view returns (uint256 profit) {
        0;
    }

    function purchase(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        uint256 amount
    )
        external
        override
        payable
        nonReentrant
        onlyInstrument
        returns (uint256 optionID)
    {
        0;
    }

    function exercise(
        address optionsAddress,
        uint256 optionID,
        uint256 amount
    ) external override payable onlyInstrument nonReentrant {}

    function setOTokenWithTerms(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType,
        address oToken
    ) external onlyOwner {
        bytes memory optionTerms = abi.encode(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        optionTermsToOToken[optionTerms] = oToken;
    }

    function lookupOToken(
        address underlying,
        address strikeAsset,
        uint256 expiry,
        uint256 strikePrice,
        OptionType optionType
    ) public view returns (address oToken) {
        bytes memory optionTerms = abi.encode(
            underlying,
            strikeAsset,
            expiry,
            strikePrice,
            optionType
        );
        return optionTermsToOToken[optionTerms];
    }

    function getUniswapExchangeFromOToken(address oToken)
        private
        view
        returns (UniswapExchangeInterface uniswapExchange)
    {
        IOptionsExchange optionsExchange = IOToken(oToken).optionsExchange();
        IUniswapFactory uniswapFactory = optionsExchange.uniswapFactory();
        uniswapExchange = UniswapExchangeInterface(
            uniswapFactory.getExchange(oToken)
        );
    }
}
