const DataProvider = artifacts.require("DataProvider");
const LiquidatorProxy = artifacts.require("LiquidatorProxy");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");
const { ether } = require("@openzeppelin/test-helpers");

/**
 * Deploys the dependency needed for Factory
 */
module.exports = async function (deployer, _, accounts) {
  const [admin, owner] = accounts;

  // deployment steps
  await deployer.deploy(DataProvider);

  await deployer.deploy(LiquidatorProxy);

  const initBytes = encodeCall(
    "initialize",
    ["address", "uint256"],
    [owner, ether("1.05").toString()]
  );
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    LiquidatorProxy.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
};
