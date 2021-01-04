const Factory = artifacts.require("DojiFactory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");
const { constants } = require("@openzeppelin/test-helpers");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ADDRESSES = require("../constants/externalAddresses.json");

module.exports = async function (deployer, network, accounts) {
  const [admin, owner] = accounts;
  console.log(admin);
  console.log(owner);

  let wethAddress;
  if (network === "development") {
    wethAddress = constants.ZERO_ADDRESS;
  } else {
    wethAddress = ADDRESSES[network.replace("-fork", "")].assets.weth;
  }

  await deployFactory(deployer, admin, owner);
  await updateDeployedAddresses(
    network,
    "DojiFactory",
    AdminUpgradeabilityProxy.address
  );
};

async function deployFactory(deployer, admin, owner) {
  await deployer.deploy(Factory);

  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "address", "address"],
    [owner, admin]
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
