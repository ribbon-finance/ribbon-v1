## `IAggregatedOptionsInstrument`






### `cost(string[] venues, enum ProtocolAdapterTypes.OptionType[] optionTypes, uint256[] amounts, uint256[] strikePrices) → uint256` (external)





### `exerciseProfit(address account, uint256 positionID) → uint256` (external)





### `canExercise(address account, uint256 positionID) → bool` (external)





### `buyInstrument(string[] venues, enum ProtocolAdapterTypes.OptionType[] optionTypes, uint256 amount, uint256[] strikePrices, bytes[] buyData) → uint256 positionID` (external)





### `exercisePosition(uint256 positionID) → uint256 profit` (external)





### `underlying() → address` (external)





### `strikeAsset() → address` (external)





### `collateralAsset() → address` (external)





### `expiry() → uint256` (external)





### `getInstrumentPositions(address account) → struct InstrumentPosition[] positions` (external)






