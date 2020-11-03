const TwinYield = artifacts.require("TwinYield");

async function deployTwinYieldLogic(deployer) {
  await deployer.deploy(TwinYield);
}

module.exports = async function (deployer) {
  await deployTwinYieldLogic(deployer);
};
