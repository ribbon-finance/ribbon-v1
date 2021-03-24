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
  const { admin, owner } = ACCOUNTS[network.replace("-fork", "")];

  // Deploying the ProtocolAdapter
  await deployer.deploy(ProtocolAdapterLib);

  await updateDeployedAddresses(
    network,
    "ProtocolAdapterLib",
    ProtocolAdapterLib.address
  );

  await deployer.link(ProtocolAdapterLib, RibbonCoveredCall);

  // Deploying the logic contract
  await deployer.deploy(
    RibbonCoveredCall,
    DEPLOYMENTS[network].RibbonFactory,
    EXTERNAL_ADDRESSES[network].assets.weth,
    EXTERNAL_ADDRESSES[network].assets.usdc,
    EXTERNAL_ADDRESSES[network].airswapSwap,
    { from: admin }
  );
  await updateDeployedAddresses(
    network,
    "RibbonETHCoveredCallLogic",
    RibbonCoveredCall.address
  );

  // Deploying the proxy contract
  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "address", "uint256"],
    [
      EXTERNAL_ADDRESSES[network].assets.weth,
      owner,
      owner,
      parseEther("1000").toString(),
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
    "RibbonETHCoveredCall",
    AdminUpgradeabilityProxy.address
  );
};
