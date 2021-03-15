## `RibbonVolatility`






### `receive()` (external)





### `initialize(address _owner, address _factory, string _name, string _symbol, address _underlying, address _strikeAsset, address _collateralAsset, uint256 _expiry)` (public)





### `exerciseProfit(address account, uint256 positionID) → uint256` (external)





### `canExercise(address account, uint256 positionID) → bool` (external)





### `buyInstrument(struct RibbonVolatility.BuyInstrumentParams params) → uint256 positionID` (external)





### `exercisePosition(uint256 positionID) → uint256 totalProfit` (external)





### `claimRewards(address rewardsAddress)` (external)





### `rewardsClaimable(address rewardsAddress) → uint256 rewardsToClaim` (external)






### `PositionCreated(address account, uint256 positionID, string[] venues, enum ProtocolAdapterTypes.OptionType[] optionTypes, uint256 amount)`





### `Exercised(address account, uint256 positionID, uint256 totalProfit, bool[] optionsExercised)`





### `ClaimedRewards(uint256 numRewards)`





