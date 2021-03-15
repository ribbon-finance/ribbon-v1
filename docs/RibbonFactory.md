## `RibbonFactory`






### `initialize(address _owner, address _instrumentAdmin)` (public)

Constructor takes a DataProvider contract address



### `getInstrument(string _name) → address instrumentAddress` (public)

Getter for getting contract address by instrument name



### `newInstrument(address _logic, bytes _initData) → address instrumentAddress` (public)





### `burnGasTokens()` (public)





### `setAdapter(string protocolName, address adapter)` (public)





### `getAdapters() → address[] _adapters` (external)






### `InstrumentCreated(string symbol, address instrumentAddress)`

Emitted when a new instrument is created



### `ProxyCreated(address logic, address proxyAddress, bytes initData)`

Emitted when a new instrument is created



### `AdapterSet(string protocolName, address adapterAddress)`





