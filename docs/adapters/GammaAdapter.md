## `GammaAdapter`






### `constructor(address _oTokenFactory, address _gammaController)` (public)

Constructor for the GammaAdapter which initializes a few immutable variables to be used by instrument contracts.




### `receive()` (external)





### `protocolName() → string` (external)





### `nonFungible() → bool` (external)





### `purchaseMethod() → enum ProtocolAdapterTypes.PurchaseMethod` (external)





### `optionsExist(struct ProtocolAdapterTypes.OptionTerms optionTerms) → bool` (external)

Check if an options contract exist based on the passed parameters.




### `getOptionsAddress(struct ProtocolAdapterTypes.OptionTerms optionTerms) → address` (external)

Get the options contract's address based on the passed parameters




### `premium(struct ProtocolAdapterTypes.OptionTerms, uint256) → uint256 cost` (external)

Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.



### `exerciseProfit(address options, uint256, uint256 amount) → uint256 profit` (public)

Amount of profit made from exercising an option contract abs(current price - strike price). 0 if exercising out-the-money.




### `canExercise(address options, uint256, uint256 amount) → bool` (public)

Helper function that returns true if the option can be exercised now.




### `purchase(struct ProtocolAdapterTypes.OptionTerms, uint256, uint256) → uint256` (external)

Stubbed out for conforming to the IProtocolAdapter interface.



### `purchaseWithZeroEx(struct ProtocolAdapterTypes.OptionTerms optionTerms, struct ProtocolAdapterTypes.ZeroExOrder zeroExOrder)` (external)

Purchases otokens using a 0x order struct




### `exercise(address options, uint256, uint256 amount, address recipient)` (public)

Exercises the options contract.




### `createShort(struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 depositAmount) → uint256` (external)

Creates a short otoken position by opening a vault, depositing collateral and minting otokens.
The sale of otokens is left to the caller contract to perform.




### `closeShort() → uint256` (external)

Close the existing short otoken position. Currently this implementation is simple.
It closes the most recent vault opened by the contract. This assumes that the contract will
only have a single vault open at any given time. Since calling `closeShort` deletes vaults,
this assumption should hold.



### `lookupOToken(struct ProtocolAdapterTypes.OptionTerms optionTerms) → address oToken` (public)

Function to lookup oToken addresses. oToken addresses are keyed by an ABI-encoded byte string





