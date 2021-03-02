const RibbonETHCoveredCall = artifacts.require("RibbonETHCoveredCall");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const { encodeCall } = require("@openzeppelin/upgrades");

const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");
const DEPLOYMENTS = require("../constants/deployments.json");

module.exports = async function (deployer, network) {
  const { admin, owner } = ACCOUNTS[network.replace("-fork", "")];

  // Deploying the ProtocolAdapter
  await deployer.deploy(ProtocolAdapterLib);

  await updateDeployedAddresses(
    network,
    "ProtocolAdapterLib",
    ProtocolAdapterLib.address
  );

  await deployer.link(ProtocolAdapterLib, RibbonETHCoveredCall);

  // Deploying the logic contract
  await deployer.deploy(RibbonETHCoveredCall, { from: admin });
  await updateDeployedAddresses(
    network,
    "RibbonETHCoveredCallLogic",
    RibbonETHCoveredCall.address
  );

  // Deploying the proxy contract
  const initBytes = encodeCall(
    "initialize",
    ["address", "address"],
    [owner, DEPLOYMENTS[network].RibbonFactory]
  );

  await deployer.deploy(
    AdminUpgradeabilityProxy,
    RibbonETHCoveredCall.address,
    admin,
    initBytes,
    { from: admin }
  );
  await updateDeployedAddresses(
    network,
    "RibbonETHCoveredCall",
    AdminUpgradeabilityProxy.address
  );
};
