const DojiVolatility = artifacts.require("DojiVolatility");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");

let deployer;

module.exports = async function (_deployer, network) {
  deployer = _deployer;

  await deployer.deploy(ProtocolAdapterLib);

  deployer.link(ProtocolAdapterLib, DojiVolatility);

  await deployer.deploy(DojiVolatility);

  await updateDeployedAddresses(
    network,
    "DojiVolatilityLogic",
    DojiVolatility.address
  );
};
