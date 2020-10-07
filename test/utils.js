const { contract } = require("@openzeppelin/test-environment");
const { ether } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("Factory");
const Instrument = contract.fromArtifact("Instrument");
const MockERC20 = contract.fromArtifact("MockERC20");
const DToken = contract.fromArtifact("DToken");
const MockDataProvider = contract.fromArtifact("MockDataProvider");

module.exports = {
  getDefaultArgs,
  deployProxy,
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
  const expiry = "1608883200";
  const colRatio = ether("1.15");

  const dataProvider = await MockDataProvider.new({ from: owner });

  const factory = await deployProxy(
    Factory,
    admin,
    ["address"],
    [dataProvider.address]
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
    { from: owner }
  );

  const instrument = await Instrument.at(res.logs[0].args.instrumentAddress);
  const dToken = await DToken.at(await instrument.dToken());

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
    args,
  };
}
