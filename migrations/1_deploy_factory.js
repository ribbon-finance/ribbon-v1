const Factory = artifacts.require("RibbonFactory");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const { encodeCall } = require("@openzeppelin/upgrades");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");

let network;

module.exports = async function (deployer, _network) {
  network = _network;
  console.log(network);
  const { admin, owner } = ACCOUNTS[network.replace("-fork", "")];

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
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    Factory.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
  await updateDeployedAddresses(
    network,
    "RibbonFactory",
    AdminUpgradeabilityProxy.address
  );
}
