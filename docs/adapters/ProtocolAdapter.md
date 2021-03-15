## `ProtocolAdapter`

ProtocolAdapter is used to shadow IProtocolAdapter to provide functions that delegatecall's the underlying IProtocolAdapter functions.




### `delegateOptionsExist(contract IProtocolAdapter adapter, struct ProtocolAdapterTypes.OptionTerms optionTerms) → bool` (external)





### `delegateGetOptionsAddress(contract IProtocolAdapter adapter, struct ProtocolAdapterTypes.OptionTerms optionTerms) → address` (external)





### `delegatePremium(contract IProtocolAdapter adapter, struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 purchaseAmount) → uint256` (external)





### `delegateExerciseProfit(contract IProtocolAdapter adapter, address options, uint256 optionID, uint256 amount) → uint256` (external)





### `delegatePurchase(contract IProtocolAdapter adapter, struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 purchaseAmount, uint256 maxCost) → uint256` (external)





### `delegatePurchaseWithZeroEx(contract IProtocolAdapter adapter, struct ProtocolAdapterTypes.OptionTerms optionTerms, struct ProtocolAdapterTypes.ZeroExOrder zeroExOrder)` (external)





### `delegateExercise(contract IProtocolAdapter adapter, address options, uint256 optionID, uint256 amount, address recipient)` (external)





### `delegateClaimRewards(contract IProtocolAdapter adapter, address rewardsAddress, uint256[] optionIDs) → uint256` (external)





### `delegateRewardsClaimable(contract IProtocolAdapter adapter, address rewardsAddress, uint256[] optionIDs) → uint256` (external)





### `delegateCreateShort(contract IProtocolAdapter adapter, struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 amount) → uint256` (external)





### `delegateCloseShort(contract IProtocolAdapter adapter) → uint256` (external)






