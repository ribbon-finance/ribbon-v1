const { contract } = require("@openzeppelin/test-environment");
const { ether, BN } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("DojimaFactory");
const Instrument = contract.fromArtifact("DojimaInstrument");
const MockERC20 = contract.fromArtifact("MockERC20");
const DToken = contract.fromArtifact("DToken");
const MockDataProvider = contract.fromArtifact("MockDataProvider");
const LiquidatorProxy = contract.fromArtifact("LiquidatorProxy");

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
  const colRatio = ether("1.15");

  const dataProvider = await MockDataProvider.new({ from: owner });

  const factory = await deployProxy(
    Factory,
    admin,
    ["address"],
    [dataProvider.address]
  );
  const liquidatorProxy = await deployProxy(
    LiquidatorProxy,
    admin,
    ["address", "uint256"],
    [owner, ether("1.05").toString()]
  );

  const colAsset = await MockERC20.new("Dai Stablecoin", "Dai", supply, {
    from: user,
  });
  const targetAsset = await MockERC20.new("Ether", "ETH", supply, {
    from: user,
  });
  const res = await factory.newInstrument(
    name,
    symbol,
    expiry,
    colRatio,
    colAsset.address,
    targetAsset.address,
    liquidatorProxy.address,
    { from: owner }
  );

  const instrument = await Instrument.at(res.logs[1].args.instrumentAddress);
  const dTokenAddress = await instrument.dToken();
  const dToken = await DToken.at(dTokenAddress);

  const args = {
    supply: supply,
    name: name,
    symbol: symbol,
    expiry: expiry,
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
