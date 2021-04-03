const StakedPut = artifacts.require("StakedPut");
const AmmAdapterLib = artifacts.require("AmmAdapter");
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

   await deployer.deploy(AmmAdapterLib);

   await updateDeployedAddresses(
     network,
     "AmmAdapterLib",
     AmmAdapterLib.address
   );

  await deployer.link(AmmAdapterLib, StakedPut);

  await deployer.deploy(StakedPut, { from: admin });

  await updateDeployedAddresses(
    network,
    "StakedPutLogic",
    StakedPut.address
  );
};