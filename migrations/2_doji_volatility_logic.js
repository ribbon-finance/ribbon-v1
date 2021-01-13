const RibbonVolatility = artifacts.require("RibbonVolatility");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");

const ACCOUNTS = require("../constants/accounts.json");

let deployer, admin, owner;

module.exports = async function (_deployer, network) {
  deployer = _deployer;

  const { admin: _admin, owner: _owner } = ACCOUNTS[
    network.replace("-fork", "")
  ];
  admin = _admin;
  owner = _owner;

  await deployer.deploy(ProtocolAdapterLib);

  await updateDeployedAddresses(
    network,
    "ProtocolAdapterLib",
    ProtocolAdapterLib.address
  );

  await deployer.link(ProtocolAdapterLib, RibbonVolatility);

  await deployer.deploy(RibbonVolatility, { from: admin });

  await updateDeployedAddresses(
    network,
    "RibbonVolatilityLogic",
    RibbonVolatility.address
  );
};
