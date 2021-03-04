const HegicAdapter = artifacts.require("HegicAdapter");
const { constants } = require("@openzeppelin/test-helpers");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");

const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_WBTC_PAIR = "0xBb2b8038a1640196FbE3e38816F3e67Cba72D940";
const ETH_ADDRESS = constants.ZERO_ADDRESS;

let deployer, owner;

module.exports = async function (_deployer, _network) {
  deployer = _deployer;
  network = _network;
  let { owner: _owner } = ACCOUNTS[network.replace("-fork", "")];
  owner = _owner;

  await deployHegicAdapter();
};

async function deployHegicAdapter() {
  await deployer.deploy(
    HegicAdapter,
    HEGIC_ETH_OPTIONS,
    HEGIC_WBTC_OPTIONS,
    ETH_ADDRESS,
    WBTC_ADDRESS,
    ETH_WBTC_PAIR,
    { from: owner }
  );
  await updateDeployedAddresses(
    network,
    "HegicAdapterLogic",
    HegicAdapter.address
  );
}
