const DataProvider = artifacts.require("DataProvider");
const LiquidatorProxy = artifacts.require("LiquidatorProxy");
const Factory = artifacts.require("DojimaFactory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");
const { ether, constants } = require("@openzeppelin/test-helpers");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ADDRESSES = require("../constants/externalAddresses.json");

module.exports = async function (deployer, network, accounts) {
  const [admin, owner] = accounts;

  let wethAddress;
  if (network === "development") {
    wethAddress = constants.ZERO_ADDRESS;
  } else {
    wethAddress = ADDRESSES[network].assets.weth;
  }

  await deployer.deploy(DataProvider, wethAddress);
  await updateDeployedAddresses(network, "DataProvider", DataProvider.address);

  await deployLiquidatorProxy(deployer, admin, owner);
  await updateDeployedAddresses(
    network,
    "LiquidatorProxy",
    AdminUpgradeabilityProxy.address
  );

  await deployFactory(deployer, admin, owner);
  await updateDeployedAddresses(
    network,
    "DojimaFactory",
    AdminUpgradeabilityProxy.address
  );
};

async function deployLiquidatorProxy(deployer, admin, owner) {
  await deployer.deploy(LiquidatorProxy);

  const liquidatorProxy = LiquidatorProxy.address;

  const initBytes = encodeCall(
    "initialize",
    ["address", "uint256"],
    [owner, ether("1.05").toString()]
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

async function deployFactory(deployer, admin, owner) {
  await deployer.deploy(Factory);

  const dataProvider = DataProvider.address;
  const liquidatorProxy = AdminUpgradeabilityProxy.address;

  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "address", "address"],
    [owner, dataProvider, admin, liquidatorProxy]
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
