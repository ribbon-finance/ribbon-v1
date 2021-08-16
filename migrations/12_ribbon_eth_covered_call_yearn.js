const RibbonThetaVaultYearn = artifacts.require("RibbonThetaVaultYearn");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const { encodeCall } = require("@openzeppelin/upgrades");
const { ethers, BigNumber } = require("ethers");
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

  await ProtocolAdapterLib.deployed();

  await deployer.link(ProtocolAdapterLib, RibbonThetaVaultYearn);

  // Deploying the logic contract
  await deployer.deploy(
    RibbonThetaVaultYearn,
    EXTERNAL_ADDRESSES[networkLookup].assets.weth,
    DEPLOYMENTS[networkLookup].RibbonFactory,
    EXTERNAL_ADDRESSES[networkLookup].assets.weth,
    EXTERNAL_ADDRESSES[networkLookup].assets.usdc,
    EXTERNAL_ADDRESSES[networkLookup].yearnRegistry,
    EXTERNAL_ADDRESSES[networkLookup].airswapSwap,
    18,
    // WETH: 10**18, 10**10 0.0000001
    // WBTC: 0.000001
    BigNumber.from("10").pow(BigNumber.from("10")).toString(), // WBTC 10**3
    false,
    { from: admin }
  );
  await updateDeployedAddresses(
    network,
    "RibbonyvETHCoveredCallLogic",
    RibbonThetaVaultYearn.address
  );

  // Deploying the proxy contract
  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "uint256", "string", "string"],
    [
      owner,
      owner,
      parseEther("1000").toString(),
      "Ribbon yvETH Theta Vault",
      "rETH-THETA-YEARN",
    ]
  );

  await deployer.deploy(
    AdminUpgradeabilityProxy,
    RibbonThetaVaultYearn.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );

  await updateDeployedAddresses(
    network,
    "RibbonETHYearnCoveredCall",
    AdminUpgradeabilityProxy.address
  );
};
