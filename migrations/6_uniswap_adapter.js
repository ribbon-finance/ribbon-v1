const UniswapAdapter = artifacts.require("UniswapAdapter");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const SUSHISWAP_ADDRESS = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
const SUSHISWAP_LP = "0x9a13867048e01c663ce8ce2fe0cdae69ff9f35e3";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const DIGG_ADDRESS = "0x798d1be841a82a273720ce31c822c61a67a601c3";

let deployer, owner;

module.exports = async function (_deployer, _network) {
  deployer = _deployer;
  network = _network;
  let { owner: _owner } = ACCOUNTS[network.replace("-fork", "")];
  owner = _owner;

  await deployUniswapAdapter();
};

async function deployUniswapAdapter() {
  await deployer.deploy(
    SUSHISWAP_ADDRESS,
    WBTC_ADDRESS,
    WETH_ADDRESS,
    SUSHISWAP_LP,
    DIGG_ADDRESS,
    { from: owner }
  );
  await updateDeployedAddresses(
    network,
    "UniswapAdapterLogic",
    UniswapAdapter.address
  );
}