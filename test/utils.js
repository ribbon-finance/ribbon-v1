const { contract, accounts } = require("@openzeppelin/test-environment");
const { ether, BN } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("@openzeppelin/upgrades");

const AdminUpgradeabilityProxy = contract.fromArtifact(
  "AdminUpgradeabilityProxy"
);
const Factory = contract.fromArtifact("DojiFactory");
const MockOToken = contract.fromArtifact("MockOToken");
const MockOptionsExchange = contract.fromArtifact("MockOptionsExchange");
const MockUniswapFactory = contract.fromArtifact("MockUniswapFactory");
const MockUniswapExchange = contract.fromArtifact("MockUniswapExchange");
const [admin, owner] = accounts;

module.exports = {
  getDefaultArgs,
  deployProxy,
  wmul,
  wdiv,
  deployDefaultUniswap,
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

async function getDefaultArgs(admin, owner, user) {
  const factory = await deployProxy(
    Factory,
    admin,
    ["address", "address"],
    [owner, admin]
  );

  return {
    factory,
  };
}

async function deployDefaultUniswap() {
  const uniswapExchange = await MockUniswapExchange.new({ from: owner });
  const uniswapFactory = await MockUniswapFactory.new({ from: owner });
  const optionsExchange = await MockOptionsExchange.new({ from: owner });
  const oToken = await MockOToken.new(
    "ETH/USD CALL",
    "ETH/USD-CALL",
    ether("1000"),
    {
      from: owner,
    }
  );

  // setup the pool to be ready to transfer
  await oToken.transfer(uniswapExchange.address, ether("100"), { from: owner });
  await uniswapExchange.setToken(oToken.address);

  await uniswapFactory.setExchange(oToken.address, uniswapExchange.address);
  await optionsExchange.setFactory(uniswapFactory.address);
  await oToken.setOptionsExchange(optionsExchange.address);

  return {
    uniswapFactory,
    optionsExchange,
    oToken,
    uniswapExchange,
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
