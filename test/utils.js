const { contract } = require("@openzeppelin/test-environment");
const { ether, BN } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("DojimaFactory");
const Instrument = contract.fromArtifact("TwinYield");
const MockERC20 = contract.fromArtifact("MockERC20");
const DToken = contract.fromArtifact("DToken");
const MockDataProvider = contract.fromArtifact("MockDataProvider");
const LiquidatorProxy = contract.fromArtifact("LiquidatorProxy");
const MockBFactory = contract.fromArtifact("MockBFactory");

module.exports = {
  getDefaultArgs,
  deployProxy,
  wmul,
  wdiv,
};

async function deployProxy(
  LogicContract,
  admin,
  initializeTypes,
  initializeArgs
) {
  const logic = await LogicContract.new();

  const initBytes = encodeCall("initialize", initializeTypes, initializeArgs);
  const proxy = await AdminUpgradeabilityProxy.new(
    logic.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
  return await LogicContract.at(proxy.address);
}

async function getDefaultArgs(admin, owner, user) {
  const supply = ether("1000000000000");
  const name = "ETH Future Expiry 12/25/20";
  const symbol = "dETH-1225";
  const expiry = "32503680000";
  const strikePrice = "40000000000";
  const colRatio = ether("1.15");

  const dataProvider = await MockDataProvider.new({ from: owner });

  const liquidatorProxy = await deployProxy(
    LiquidatorProxy,
    admin,
    ["address", "uint256"],
    [owner, ether("1.05").toString()]
  );
  const factory = await deployProxy(
    Factory,
    admin,
    ["address", "address", "address"],
    [owner, dataProvider.address, liquidatorProxy.address]
  );
  const instrumentLogic = await Instrument.new({ from: owner });

  const colAsset = await MockERC20.new("Ether", "ETH", supply, {
    from: user,
  });
  const targetAsset = await MockERC20.new("USD", "USDC", supply, {
    from: user,
  });
  const paymentToken = await MockERC20.new("USD Coin", "USDC", supply, {
    from: user,
  });
  const bFactory = await MockBFactory.new({ from: user });

  const initTypes = [
    "address",
    "string",
    "string",
    "uint256",
    "uint256",
    "uint256",
    "address",
    "address",
    "address",
    "address",
    "address",
  ];
  const initArgs = [
    await factory.dataProvider(),
    name,
    symbol,
    expiry.toString(),
    strikePrice.toString(),
    colRatio.toString(),
    colAsset.address,
    targetAsset.address,
    paymentToken.address,
    await factory.liquidatorProxy(),
    bFactory.address,
  ];
  const initBytes = encodeCall("initialize", initTypes, initArgs);

  const res = await factory.newInstrument(instrumentLogic.address, initBytes, {
    from: owner,
  });

  const instrument = await Instrument.at(res.logs[1].args.instrumentAddress);
  const dTokenAddress = await instrument.dToken();
  const dToken = await DToken.at(dTokenAddress);

  const args = {
    supply: supply,
    name: name,
    symbol: symbol,
    expiry: expiry,
    strikePrice: strikePrice,
    colRatio: colRatio,
  };

  return {
    factory,
    colAsset,
    targetAsset,
    instrument,
    dToken,
    liquidatorProxy,
    args,
    dataProvider,
    bFactory,
    paymentToken,
    instrumentLogic,
  };
}

function wdiv(x, y) {
  return x
    .mul(ether("1"))
    .add(y.div(new BN("2")))
    .div(y);
}

function wmul(x, y) {
  return x
    .mul(y)
    .add(ether("1").div(new BN("2")))
    .div(ether("1"));
}
