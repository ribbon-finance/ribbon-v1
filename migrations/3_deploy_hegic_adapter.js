const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const HegicAdapter = artifacts.require("HegicAdapter");
const { encodeCall } = require("@openzeppelin/upgrades");
const { constants } = require("@openzeppelin/test-helpers");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");
const DEPLOYMENTS = require("../constants/deployments.json");

const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.ZERO_ADDRESS;

let admin, owner, deployer, network;

module.exports = async function (_deployer, _network) {
  deployer = _deployer;
  network = _network;

  const { admin: _admin, owner: _owner } = ACCOUNTS[
    network.replace("-fork", "")
  ];
  admin = _admin;
  owner = _owner;

  await deployHegicAdapterLogic(admin, owner);
  await deployHegicAdapterProxy(admin, owner);
};

async function deployHegicAdapterLogic() {
  await deployer.deploy(
    HegicAdapter,
    HEGIC_ETH_OPTIONS,
    HEGIC_WBTC_OPTIONS,
    ETH_ADDRESS,
    WBTC_ADDRESS
  );
  await updateDeployedAddresses(
    network,
    "HegicAdapterLogic",
    HegicAdapter.address
  );
}

async function deployHegicAdapterProxy() {
  const { DojiFactory } = DEPLOYMENTS[network];

  const initBytes = encodeCall(
    "initialize",
    ["address", "address"],
    [owner, DojiFactory]
  );
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    HegicAdapter.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
  await updateDeployedAddresses(
    network,
    "HegicAdapter",
    AdminUpgradeabilityProxy.address
  );
}
