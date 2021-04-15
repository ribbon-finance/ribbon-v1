const RibbonCoveredCall = artifacts.require("RibbonCoveredCall");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const { encodeCall } = require("@openzeppelin/upgrades");
const { ethers } = require("ethers");
const { parseUnits } = ethers.utils;

const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");
const DEPLOYMENTS = require("../constants/deployments.json");
const EXTERNAL_ADDRESSES = require("../constants/externalAddresses.json");

module.exports = async function (deployer, network) {
  const networkLookup = network.replace("-fork", "");
  const { admin, owner } = ACCOUNTS[networkLookup];

  // Deploying the ProtocolAdapter
  await deployer.deploy(ProtocolAdapterLib);

  await updateDeployedAddresses(
    network,
    "ProtocolAdapterLib",
    ProtocolAdapterLib.address
  );

  await deployer.link(ProtocolAdapterLib, RibbonCoveredCall);

  // // Deploying the logic contract
  await deployer.deploy(
    RibbonCoveredCall,
    DEPLOYMENTS[networkLookup].RibbonFactory,
    EXTERNAL_ADDRESSES[networkLookup].assets.wbtc,
    EXTERNAL_ADDRESSES[networkLookup].assets.usdc,
    EXTERNAL_ADDRESSES[networkLookup].airswapSwap,
    { from: admin }
  );
  await updateDeployedAddresses(
    network,
    "RibbonWBTCCoveredCallLogic",
    RibbonCoveredCall.address
  );

  // Deploying the proxy contract
  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "address", "uint256"],
    [
      EXTERNAL_ADDRESSES[networkLookup].assets.wbtc,
      owner,
      owner,
      ethers.BigNumber.from("10").pow("11"), // 1000 (3 leading zeros) + 8 leading zeros
    ]
  );

  await deployer.deploy(
    AdminUpgradeabilityProxy,
    RibbonCoveredCall.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );

  await updateDeployedAddresses(
    network,
    "RibbonWBTCCoveredCall",
    AdminUpgradeabilityProxy.address
  );
};
