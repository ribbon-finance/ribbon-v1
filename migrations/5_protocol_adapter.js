const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");

const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");

module.exports = async function (deployer, network) {
  // Deploying the ProtocolAdapter
  await deployer.deploy(ProtocolAdapterLib);

  await updateDeployedAddresses(
    network,
    "ProtocolAdapterLib",
    ProtocolAdapterLib.address
  );
};
