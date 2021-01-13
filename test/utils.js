const { contract } = require("@openzeppelin/test-environment");
const { ether, BN, constants } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("DojiFactory");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const GammaAdapter = contract.fromArtifact("GammaAdapter");
const MockGammaController = contract.fromArtifact("MockGammaController");
const ProtocolAdapter = contract.fromArtifact("ProtocolAdapter");

module.exports = {
  getDefaultArgs,
  deployProxy,
  wmul,
  wdiv,
};

async function deployProxy(
  LogicContract,
  admin,
  initializeTypes,
  initializeArgs
) {
  const logic = await LogicContract.new();

  const initBytes = encodeCall("initialize", initializeTypes, initializeArgs);
  const proxy = await AdminUpgradeabilityProxy.new(
    logic.address,
    admin,
    initBytes,
    {
      from: admin,
    }
  );
  return await LogicContract.at(proxy.address);
}

const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.ZERO_ADDRESS;

const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const GAMMA_ORACLE = "0xc497f40D1B7db6FA5017373f1a0Ec6d53126Da23";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let factory, hegicAdapter, opynV1Adapter, gammaAdapter;

async function getDefaultArgs(admin, owner, user) {
  // ensure we just return the cached instances instead of re-initializing everything
  if (
    factory &&
    hegicAdapter &&
    opynV1Adapter &&
    gammaAdapter &&
    mockGammaController
  ) {
    return {
      factory,
      hegicAdapter,
      opynV1Adapter,
      gammaAdapter,
      mockGammaController,
    };
  }

  factory = await deployProxy(
    Factory,
    admin,
    ["address", "address"],
    [owner, admin]
  );

  hegicAdapter = await HegicAdapter.new(
    HEGIC_ETH_OPTIONS,
    HEGIC_WBTC_OPTIONS,
    ETH_ADDRESS,
    WBTC_ADDRESS,
    { from: owner }
  );

  mockGammaController = await MockGammaController.new(
    GAMMA_ORACLE,
    UNISWAP_ROUTER,
    WETH_ADDRESS
  );

  gammaAdapter = await GammaAdapter.new(
    OTOKEN_FACTORY,
    mockGammaController.address,
    WETH_ADDRESS,
    ZERO_EX_EXCHANGE,
    UNISWAP_ROUTER,
    {
      from: owner,
    }
  );

  await factory.setAdapter("HEGIC", hegicAdapter.address, { from: owner });
  await factory.setAdapter("OPYN_GAMMA", gammaAdapter.address, { from: owner });

  const protocolAdapterLib = await ProtocolAdapter.new();

  return {
    factory,
    hegicAdapter,
    gammaAdapter,
    mockGammaController,
    protocolAdapterLib,
  };
}

function wdiv(x, y) {
  return x
    .mul(ether("1"))
    .add(y.div(new BN("2")))
    .div(y);
}

function wmul(x, y) {
  return x
    .mul(y)
    .add(ether("1").div(new BN("2")))
    .div(ether("1"));
}
