const RibbonThetaVault = artifacts.require("RibbonThetaVault");
const AdminUpgradeabilityProxy = artifacts.require("AdminUpgradeabilityProxy");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const { encodeCall } = require("@openzeppelin/upgrades");
const { BigNumber } = require("ethers");

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

  await deployer.link(ProtocolAdapterLib, RibbonThetaVault);

  // // Deploying the logic contract
  await deployer.deploy(
    RibbonThetaVault,
    EXTERNAL_ADDRESSES[networkLookup].assets.wbtc,
    DEPLOYMENTS[networkLookup].RibbonFactory,
    EXTERNAL_ADDRESSES[networkLookup].thetaRegistry,
    EXTERNAL_ADDRESSES[networkLookup].assets.weth,
    EXTERNAL_ADDRESSES[networkLookup].assets.usdc,
    EXTERNAL_ADDRESSES[networkLookup].airswapSwap,
    6, // USDC is 6 decimals
    BigNumber.from("10").pow(BigNumber.from("3")).toString(),
    true,
    { from: admin }
  );
  await updateDeployedAddresses(
    network,
    "RibbonWBTCPutLogic",
    RibbonThetaVault.address
  );

  // Deploying the proxy contract
  const initBytes = encodeCall(
    "initialize",
    ["address", "address", "uint256", "string", "string"],
    [
      owner,
      owner,
      BigNumber.from("10").pow("12").toString(), // 1,000,000 (6 leading zeros) + 6 leading zeros
      "Ribbon USDC Theta Vault BTC Put",
      "rUSDC-BTC-P-THETA",
    ]
  );

  await deployer.deploy(
    AdminUpgradeabilityProxy,
    RibbonThetaVault.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );

  await updateDeployedAddresses(
    network,
    "RibbonWBTCPut",
    AdminUpgradeabilityProxy.address
  );
};
