const DojiVolatility = artifacts.require("DojiVolatility");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");

async function deployDojiVolatility(deployer) {
  await deployer.deploy(DojiVolatility);
}

module.exports = async function (deployer, network) {
  await deployDojiVolatility(deployer);
  await updateDeployedAddresses(
    network,
    "DojiVolatilityLogic",
    DojiVolatility.address
  );
};
