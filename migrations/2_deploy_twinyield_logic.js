const TwinYield = artifacts.require("TwinYield");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");

async function deployTwinYieldLogic(deployer) {
  await deployer.deploy(TwinYield);
}

module.exports = async function (deployer, network) {
  await deployTwinYieldLogic(deployer);
  await updateDeployedAddresses(network, "TwinYieldLogic", TwinYield.address);
};
