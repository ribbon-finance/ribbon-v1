const { contract } = require("@openzeppelin/test-environment");
const { ether, BN, constants } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("DojiFactory");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const OpynV1Adapter = contract.fromArtifact("OpynV1Adapter");
const { setupOTokenAndVaults } = require("./opyn_v1");

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
const AAVE_ADDRESS_PROVIDER = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let factory, hegicAdapter, opynV1Adapter;

async function getDefaultArgs(admin, owner, user) {
  // ensure we just return the cached instances instead of re-initializing everything
  if (factory && hegicAdapter && opynV1Adapter) {
    return { factory, hegicAdapter, opynV1Adapter };
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
  await hegicAdapter.initialize(owner, factory.address, { from: owner });

  opynV1Adapter = await OpynV1Adapter.new(AAVE_ADDRESS_PROVIDER, {
    from: owner,
  });

  await opynV1Adapter.initialize(
    owner,
    factory.address,
    AAVE_ADDRESS_PROVIDER,
    UNISWAP_ROUTER,
    WETH_ADDRESS,
    { from: owner }
  );
  await setupOTokenAndVaults(opynV1Adapter, owner);

  await factory.setAdapter("HEGIC", hegicAdapter.address, { from: owner });
  await factory.setAdapter("OPYN_V1", opynV1Adapter.address, { from: owner });

  return {
    factory,
    hegicAdapter,
    opynV1Adapter,
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
