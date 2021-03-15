## `HegicAdapter`






### `constructor(address _ethOptions, address _wbtcOptions, address _ethAddress, address _wbtcAddress, address _ethWbtcPair)` (public)

constructor for the HegicAdapter




### `receive()` (external)





### `protocolName() → string` (public)





### `nonFungible() → bool` (external)





### `purchaseMethod() → enum ProtocolAdapterTypes.PurchaseMethod` (external)





### `optionsExist(struct ProtocolAdapterTypes.OptionTerms optionTerms) → bool` (external)

Check if an options contract exist based on the passed parameters.




### `getOptionsAddress(struct ProtocolAdapterTypes.OptionTerms optionTerms) → address` (external)

Get the options contract's address based on the passed parameters




### `premium(struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 purchaseAmount) → uint256 cost` (public)

Gets the premium to buy `purchaseAmount` of the option contract in ETH terms.




### `exerciseProfit(address optionsAddress, uint256 optionID, uint256) → uint256 profit` (public)

Amount of profit made from exercising an option contract (current price - strike price). 0 if exercising out-the-money.




### `canExercise(address options, uint256 optionID, uint256 amount) → bool` (public)





### `purchase(struct ProtocolAdapterTypes.OptionTerms optionTerms, uint256 amount, uint256 maxCost) → uint256 optionID` (external)

Purchases the options contract.




### `exercise(address optionsAddress, uint256 optionID, uint256 amount, address account)` (external)

Exercises the options contract.




### `_swapWBTCToETH(uint256 costWBTC, uint256 costETH)` (internal)





### `_getAmountsIn(uint256 amountOut) → uint256 amountIn` (internal)





### `rewardsClaimable(address rewardsAddress, uint256[] optionIDs) → uint256 rewardsAmount` (external)

Function to get rHEGIC2 rewards claimable from liquidity utilization




### `claimRewards(address rewardsAddress, uint256[] optionIDs) → uint256 rewardsAmount` (external)

Function to get rHEGIC2 rewards claimable from liquidity utilization




### `createShort(struct ProtocolAdapterTypes.OptionTerms, uint256) → uint256` (external)





### `closeShort() → uint256` (external)






