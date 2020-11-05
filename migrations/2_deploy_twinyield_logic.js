const TwinYield = artifacts.require("TwinYield");
const {
  updateDeployedAddresses,
} = require("../scripts/updateDeployedAddresses");

async function deployTwinYieldLogic(deployer) {
  await deployer.deploy(TwinYield);
}

module.exports = async function (deployer, network) {
  await deployTwinYieldLogic(deployer);
  await updateDeployedAddresses(network, "TwinYieldLogic", TwinYield.address);
};
