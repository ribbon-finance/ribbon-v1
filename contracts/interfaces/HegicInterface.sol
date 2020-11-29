// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

enum OptionType {Invalid, Put, Call}

interface IHegicOptions {
    event Create(
        uint256 indexed id,
        address indexed account,
        uint256 settlementFee,
        uint256 totalFee
    );

    event Exercise(uint256 indexed id, uint256 profit);
    event Expire(uint256 indexed id, uint256 premium);
    enum State {Inactive, Active, Exercised, Expired}

    struct Option {
        State state;
        address payable holder;
        uint256 strike;
        uint256 amount;
        uint256 lockedAmount;
        uint256 premium;
        uint256 expiration;
        OptionType optionType;
    }

    function options(uint256)
        external
        view
        returns (
            State state,
            address payable holder,
            uint256 strike,
            uint256 amount,
            uint256 lockedAmount,
            uint256 premium,
            uint256 expiration,
            OptionType optionType
        );

    function create(
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    ) external payable returns (uint256 optionID);

    function exercise(uint256 optionID) external;
}

interface IHegicETHOptions is IHegicOptions {
    function fees(
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    )
        external
        view
        returns (
            uint256 total,
            uint256 settlementFee,
            uint256 strikeFee,
            uint256 periodFee
        );
}

interface IHegicBTCOptions is IHegicOptions {
    function fees(
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    )
        external
        returns (
            uint256 total,
            uint256 totalETH,
            uint256 settlementFee,
            uint256 strikeFee,
            uint256 periodFee
        );
}
