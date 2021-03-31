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
  const networkAddressLookup = network.replace("-fork", "");

  await deployer.deploy(
    GammaAdapter,
    EXTERNAL_ADDRESSES[networkAddressLookup].oTokenFactory,
    EXTERNAL_ADDRESSES[networkAddressLookup].gammaController,
    EXTERNAL_ADDRESSES[networkAddressLookup].gammaMarginPool,
    EXTERNAL_ADDRESSES[networkAddressLookup].feeds["usdc/eth"],
    EXTERNAL_ADDRESSES[networkAddressLookup].uniswapV2Router,
    EXTERNAL_ADDRESSES[networkAddressLookup].assets.weth,
    EXTERNAL_ADDRESSES[networkAddressLookup].assets.usdc,
    EXTERNAL_ADDRESSES[networkAddressLookup].zeroExExchangeV3,
    {
      from: owner,
    }
  );

  await updateDeployedAddresses(
    network,
    "GammaAdapterLogic",
    GammaAdapter.address
  );
}
