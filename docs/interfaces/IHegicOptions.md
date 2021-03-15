## `IHegicOptions`






### `options(uint256) → enum State state, address payable holder, uint256 strike, uint256 amount, uint256 lockedAmount, uint256 premium, uint256 expiration, enum HegicOptionType optionType` (external)





### `create(uint256 period, uint256 amount, uint256 strike, enum HegicOptionType optionType) → uint256 optionID` (external)





### `exercise(uint256 optionID)` (external)





### `priceProvider() → address` (external)






### `Create(uint256 id, address account, uint256 settlementFee, uint256 totalFee)`





### `Exercise(uint256 id, uint256 profit)`





### `Expire(uint256 id, uint256 premium)`





