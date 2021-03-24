const GammaAdapter = artifacts.require("GammaAdapter");
const RibbonFactory = artifacts.require("RibbonFactory");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const DEPLOYMENTS = require("../constants/deployments.json");
const EXTERNAL_ADDRESSES = require("../constants/externalAddresses.json");
const ACCOUNTS = require("../constants/accounts.json");

let deployer, network, owner;

module.exports = async function (_deployer, _network) {
  deployer = _deployer;
  network = _network;
  const { owner: _owner } = ACCOUNTS[network.replace("-fork", "")];
  owner = _owner;

  await deployGammaAdapter();
};

async function deployGammaAdapter() {
  await deployer.deploy(
    GammaAdapter,
    EXTERNAL_ADDRESSES[network].oTokenFactory,
    EXTERNAL_ADDRESSES[network].gammaController,
    EXTERNAL_ADDRESSES[network].gammaMarginPool,
    EXTERNAL_ADDRESSES[network].feeds["eth/usd"],
    EXTERNAL_ADDRESSES[network].uniswapV2Router,
    EXTERNAL_ADDRESSES[network].assets.weth,
    EXTERNAL_ADDRESSES[network].assets.usdc,
    EXTERNAL_ADDRESSES[network].zeroExExchangeV3,
    {
      from: owner,
    }
  );

  await updateDeployedAddresses(
    network,
    "GammaAdapterLogic",
    GammaAdapter.address
  );

  console.log("Setting GammaAdapter at factory...");
  const factory = await RibbonFactory.at(DEPLOYMENTS[network].RibbonFactory);
  await factory.setAdapter("OPYN_GAMMA", GammaAdapter.address, { from: owner });
  console.log("Done.");
}
