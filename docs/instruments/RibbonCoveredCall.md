## `RibbonCoveredCall`





### `onlyManager()`

Only allows manager to execute a function




### `constructor(address _factory)` (public)

Initializes the factory and adapter contract addresses



### `initialize(address _asset, address _owner, address _feeRecipient, uint256 _initCap)` (external)

Initializes the OptionVault contract with an owner and a factory.




### `setManager(address newManager)` (external)

Sets the new manager of the vault. Revoke the airswap signer authorization from the old manager, and authorize the manager.




### `setFeeRecipient(address newFeeRecipient)` (external)

Sets the new fee recipient




### `depositETH()` (external)

Deposits ETH into the contract and mint vault shares. Reverts if the underlying is not WETH.



### `deposit(uint256 amount)` (external)

Deposits the `asset` into the contract and mint vault shares.




### `withdrawETH(uint256 share)` (external)

Withdraws ETH from vault using vault shares




### `withdraw(uint256 share)` (external)

Withdraws WETH from vault using vault shares




### `rollToNextOption(struct ProtocolAdapterTypes.OptionTerms optionTerms)` (external)

Rolls from one short option position to another. Closes the expired short position, withdraw from it, then open a new position.




### `setCap(uint256 newCap)` (external)

Sets a new cap for deposits




### `currentOptionExpiry() → uint256` (external)

Returns the expiry of the current option the vault is shorting



### `totalBalance() → uint256` (public)

Returns the vault's total balance, including the amounts locked into a short position



### `availableToWithdraw() → uint256` (external)

Returns the amount available for users to withdraw. MIN(10% * (locked + assetBalance), assetBalance)



### `decimals() → uint8` (public)

Returns the token decimals




### `ManagerChanged(address oldManager, address newManager)`





### `Deposit(address account, uint256 amount, uint256 share)`





### `Withdraw(address account, uint256 amount, uint256 share, uint256 fee)`





### `OpenShort(address options, uint256 depositAmount, address manager)`





### `CloseShort(address options, uint256 withdrawAmount, address manager)`





### `CapSet(uint256 oldCap, uint256 newCap, address manager)`





