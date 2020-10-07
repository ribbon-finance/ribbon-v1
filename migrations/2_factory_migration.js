const DataProvider = artifacts.require("DataProvider");
const Factory = artifacts.require("Factory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");

async function deployFactory(deployer, admin, dataProviderAddress) {
  await deployer.deploy(Factory);

  const initBytes = encodeCall(
    "initialize",
    ["address"],
    [dataProviderAddress]
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

  // deployment steps
  await deployer.deploy(DataProvider);
  await deployFactory(deployer, admin, DataProvider.address);
};
