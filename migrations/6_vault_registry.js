const VaultRegistry = artifacts.require("VaultRegistry");

const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");

module.exports = async function (deployer, network) {
  const networkLookup = network.replace("-fork", "");
  const { owner } = ACCOUNTS[networkLookup];

  await deployer.deploy(VaultRegistry, { from: owner });

  await updateDeployedAddresses(
    network,
    "VaultRegistry",
    VaultRegistry.address
  );
};
