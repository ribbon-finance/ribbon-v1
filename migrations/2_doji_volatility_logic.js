const DojiVolatility = artifacts.require("DojiVolatility");
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

  deployer.link(ProtocolAdapterLib, DojiVolatility);

  await deployer.deploy(DojiVolatility, { from: admin });

  await updateDeployedAddresses(
    network,
    "DojiVolatilityLogic",
    DojiVolatility.address
  );
};
