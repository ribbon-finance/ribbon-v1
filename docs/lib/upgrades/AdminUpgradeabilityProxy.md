## `AdminUpgradeabilityProxy`



This contract combines an upgradeability proxy with an authorization
mechanism for administrative tasks.
All external functions in this contract must be guarded by the
`ifAdmin` modifier. See ethereum/solidity#3864 for a Solidity
feature proposal that would enable this to be done automatically.

### `ifAdmin()`



Modifier to check whether the `msg.sender` is the admin.
If it is, it will run the function. Otherwise, it will delegate the call
to the implementation.


### `constructor(address _logic, address _admin, bytes _data)` (public)

Contract constructor.




### `admin() → address` (external)





### `implementation() → address` (external)





### `changeAdmin(address newAdmin)` (external)



Changes the admin of the proxy.
Only the current admin can call this function.


### `upgradeTo(address newImplementation)` (external)



Upgrade the backing implementation of the proxy.
Only the admin can call this function.


### `upgradeToAndCall(address newImplementation, bytes data)` (external)



Upgrade the backing implementation of the proxy and call a function
on the new implementation.
This is useful to initialize the proxied contract.


### `_admin() → address adm` (internal)





### `_setAdmin(address newAdmin)` (internal)



Sets the address of the proxy admin.


### `_willFallback()` (internal)



Only fall back when the sender is not the admin.


### `AdminChanged(address previousAdmin, address newAdmin)`



Emitted when the administration has been transferred.


