const { contract } = require("@openzeppelin/test-environment");
const { ether, BN } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("DojiFactory");

module.exports = {
  getDefaultArgs,
  deployProxy,
  wmul,
  wdiv,
  deployDefaultUniswap,
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
  const factory = await deployProxy(
    Factory,
    admin,
    ["address", "address"],
    [owner, admin]
  );

  return {
    factory,
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
