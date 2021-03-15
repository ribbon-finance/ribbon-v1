## `IProtocolAdapter`






### `protocolName() → string` (external)

Name of the adapter. E.g. "HEGIC", "OPYN_V1". Used as index key for adapter addresses



### `nonFungible() → bool` (external)

Boolean flag to indicate whether to use option IDs or not.
Fungible protocols normally use tokens to represent option contracts.



### `purchaseMethod() → enum ProtocolAdapterTypes.PurchaseMethod` (external)

Returns the purchase method used to purchase options



### `optionsExist(struct ProtocolAdapterTypes.OptionTerms optionTerms) → bool` (external)

Check if an options contract exist based on the passed parameters.




### `getOptionsAddress(struct ProtocolAdapterTypes.OptionTerms optionTerms) → address` (external)

Get the options contract's address based on the passed parameters




### `premium(struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 purchaseAmount) → uint256 cost` (external)

Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.




### `exerciseProfit(address options, uint256 optionID, uint256 amount) → uint256 profit` (external)

Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.




### `canExercise(address options, uint256 optionID, uint256 amount) → bool` (external)





### `purchase(struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 amount, uint256 maxCost) → uint256 optionID` (external)

Purchases the options contract.




### `exercise(address options, uint256 optionID, uint256 amount, address recipient)` (external)

Exercises the options contract.




### `createShort(struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 amount) → uint256` (external)

Opens a short position for a given `optionTerms`.




### `closeShort() → uint256` (external)

Closes an existing short position. In the future, we may want to open this up to specifying a particular short position to close.




### `Purchased(address caller, string protocolName, address underlying, uint256 amount, uint256 optionID)`

Emitted when a new option contract is purchased



### `Exercised(address caller, address options, uint256 optionID, uint256 amount, uint256 exerciseProfit)`

Emitted when an option contract is exercised



