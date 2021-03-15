## `UpgradeabilityProxy`



This contract implements a proxy that allows to change the
implementation address to which it will delegate.
Such a change is called an implementation upgrade.


### `constructor(address _logic, bytes _data)` (public)



Contract constructor.


### `_implementation() → address impl` (internal)



Returns the current implementation.


### `_upgradeTo(address newImplementation)` (internal)



Upgrades the proxy to a new implementation.


### `_setImplementation(address newImplementation)` (internal)



Sets the implementation address of the proxy.



### `Upgraded(address implementation)`



Emitted when the implementation is upgraded.


