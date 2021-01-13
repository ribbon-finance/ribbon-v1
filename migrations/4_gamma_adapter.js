const GammaAdapter = artifacts.require("GammaAdapter");
const {
  updateDeployedAddresses,
} = require("../scripts/helpers/updateDeployedAddresses");
const ACCOUNTS = require("../constants/accounts.json");

const GAMMA_CONTROLLER = "0x4ccc2339F87F6c59c6893E1A678c2266cA58dC72";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let deployer, network, owner;

module.exports = async function (_deployer, _network) {
  deployer = _deployer;
  network = _network;
  const { owner: _owner } = ACCOUNTS[network.replace("-fork", "")];
  owner = _owner;

  await deployGammaAdapter();
};

async function deployGammaAdapter() {
  await deployer.deploy(
    GammaAdapter,
    OTOKEN_FACTORY,
    GAMMA_CONTROLLER,
    WETH_ADDRESS,
    ZERO_EX_EXCHANGE,
    UNISWAP_ROUTER,
    {
      from: owner,
    }
  );

  await updateDeployedAddresses(
    network,
    "GammaAdapterLogic",
    GammaAdapter.address
  );
}
