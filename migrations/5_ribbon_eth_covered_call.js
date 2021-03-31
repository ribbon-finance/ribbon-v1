const RibbonCoveredCall = artifacts.require("RibbonCoveredCall");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const { encodeCall } = require("@openzeppelin/upgrades");
const { ethers } = require("ethers");
const { parseEther } = ethers.utils;

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
  // await deployer.deploy(ProtocolAdapterLib);

  // await updateDeployedAddresses(
  //   network,
  //   "ProtocolAdapterLib",
  //   ProtocolAdapterLib.address
  // );

  // await deployer.link(ProtocolAdapterLib, RibbonCoveredCall);

  // // Deploying the logic contract
  // await deployer.deploy(
  //   RibbonCoveredCall,
  //   DEPLOYMENTS[networkLookup].RibbonFactory,
  //   EXTERNAL_ADDRESSES[networkLookup].assets.weth,
  //   EXTERNAL_ADDRESSES[networkLookup].assets.usdc,
  //   EXTERNAL_ADDRESSES[networkLookup].airswapSwap,
  //   { from: admin }
  // );
  // await updateDeployedAddresses(
  //   network,
  //   "RibbonETHCoveredCallLogic",
  //   RibbonCoveredCall.address
  // );

  // Deploying the proxy contract
  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "address", "uint256"],
    [
      EXTERNAL_ADDRESSES[networkLookup].assets.weth,
      owner,
      owner,
      parseEther("1000").toString(),
    ]
  );

  await deployer.deploy(
    AdminUpgradeabilityProxy,
    // RibbonCoveredCall.address,
    "0xEd61372660aeb0776d5385df2C5f99A462de0245",
    admin,
    initBytes,
    {
      from: admin,
    }
  );

  await updateDeployedAddresses(
    network,
    "RibbonETHCoveredCall",
    AdminUpgradeabilityProxy.address
  );
};
