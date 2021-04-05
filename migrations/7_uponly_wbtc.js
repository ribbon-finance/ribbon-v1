const StakedPut = artifacts.require("StakedPut");
const AmmAdapterLib = artifacts.require("AmmAdapter");

const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");

const ACCOUNTS = require("../constants/accounts.json");
const DEPLOYMENTS = require("../constants/deployments.json");
const EXTERNAL_ADDRESSES = require("../constants/externalAddresses.json");
//can we get the Uniswap Adapter address here to?

const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WBTC_OPTIONS_ADDRESS = "0x3961245db602ed7c03eeccda33ea3846bd8723bd";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_PRICE_FEED = "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c";

let deployer, admin, owner;

module.exports = async function (_deployer, network) {
  deployer = _deployer;

  const networkLookup = network.replace("-fork", "");

  const { admin: _admin, owner: _owner } = ACCOUNTS[networkLookup];
  admin = _admin;
  owner = _owner;

  await deployer.deploy(AmmAdapterLib);

  await updateDeployedAddresses(
    network,
    "AmmAdapterLib",
    AmmAdapterLib.address
  );

  await deployer.link(AmmAdapterLib, StakedPut);

  //need to get the deployed uniswap adapter address
  await deployer.deploy(
    StakedPut,
    DEPLOYMENTS[networkLookup].RibbonFactory,
    DEPLOYMENTS[networkLookup].UniswapAdapterLogic,
    EXTERNAL_ADDRESSES[networkLookup].assets.wbtc,
    EXTERNAL_ADDRESSES[networkLookup].hegicWBTCOptions,
    EXTERNAL_ADDRESSES[networkLookup].assets.usdc,
    EXTERNAL_ADDRESSES[networkLookup].feeds["wbtc/eth"],
    { from: admin }
  );

  await updateDeployedAddresses(network, "StakedPutLogic", StakedPut.address);
};
