const DataProvider = artifacts.require("DataProvider");
const LiquidatorProxy = artifacts.require("LiquidatorProxy");
const Factory = artifacts.require("DojimaFactory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");

module.exports = async function (deployer, _, accounts) {
  const [admin] = accounts;

  await deployer.deploy(Factory);

  const initBytes = encodeCall(
    "initialize",
    ["address", "address"],
    [DataProvider.address, LiquidatorProxy.address]
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
};
