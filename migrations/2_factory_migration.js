const DataProvider = artifacts.require("DataProvider");
const LiquidatorProxy = artifacts.require("LiquidatorProxy");
const Factory = artifacts.require("DojimaFactory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");
const { ether } = require("@openzeppelin/test-helpers");

async function deployLiquidatorProxy(deployer, admin) {
  await deployer.deploy(LiquidatorProxy);

  const liquidatorProxy = LiquidatorProxy.address;

  const initBytes = encodeCall(
    "initialize",
    ["address", "uint256"],
    [admin, ether("1.05").toString()]
  );
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    liquidatorProxy,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
}

async function deployFactory(deployer, admin) {
  await deployer.deploy(Factory);

  const dataProvider = DataProvider.address;
  const liquidatorProxy = AdminUpgradeabilityProxy.address;

  const initBytes = encodeCall(
    "initialize",
    ["address", "address"],
    [dataProvider, liquidatorProxy]
  );
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    Factory.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
}

module.exports = async function (deployer, _, accounts) {
  const [admin] = accounts;

  await deployer.deploy(DataProvider);

  await deployLiquidatorProxy(deployer, admin);

  await deployFactory(deployer, admin);
};
