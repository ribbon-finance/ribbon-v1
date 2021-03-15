## `ProxyAdmin`



This contract is the admin of a proxy, and is in charge
of upgrading it as well as transferring it to another admin.


### `getProxyImplementation(contract AdminUpgradeabilityProxy proxy) → address` (public)



Returns the current implementation of a proxy.
This is needed because only the proxy admin can query it.


### `getProxyAdmin(contract AdminUpgradeabilityProxy proxy) → address` (public)



Returns the admin of a proxy. Only the admin can query it.


### `changeProxyAdmin(contract AdminUpgradeabilityProxy proxy, address newAdmin)` (public)



Changes the admin of a proxy.


### `upgrade(contract AdminUpgradeabilityProxy proxy, address implementation)` (public)



Upgrades a proxy to the newest implementation of a contract.


### `upgradeAndCall(contract AdminUpgradeabilityProxy proxy, address implementation, bytes data)` (public)



Upgrades a proxy to the newest implementation of a contract and forwards a function call to it.
This is useful to initialize the proxied contract.



