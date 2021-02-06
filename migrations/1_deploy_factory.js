const Factory = artifacts.require("RibbonFactory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");
const { constants } = require("@openzeppelin/test-helpers");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ADDRESSES = require("../constants/externalAddresses.json");
const ACCOUNTS = require("../constants/accounts.json");

let network;

module.exports = async function (deployer, _network) {
  network = _network;

  const { admin, owner } = ACCOUNTS[network.replace("-fork", "")];

  let wethAddress;
  if (network === "development") {
    wethAddress = constants.ZERO_ADDRESS;
  } else {
    wethAddress = ADDRESSES[network.replace("-fork", "")].assets.weth;
  }

  await deployFactory(deployer, admin, owner);
};

async function deployFactory(deployer, admin, owner) {
  await deployer.deploy(Factory, { from: admin });
  await updateDeployedAddresses(network, "RibbonFactoryLogic", Factory.address);

  const initBytes = encodeCall(
    "initialize",
    ["address", "address"],
    [owner, admin]
  );
  // await deployer.deploy(
  //   AdminUpgradeabilityProxy,
  //   Factory.address,
  //   admin,
  //   initBytes,
  //   {
  //     from: admin,
  //   }
  // );
  // await updateDeployedAddresses(
  //   network,
  //   "RibbonFactory",
  //   AdminUpgradeabilityProxy.address
  // );
}
