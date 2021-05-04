const { encodeCall } = require("@openzeppelin/upgrades");
const { ethers, artifacts } = require("hardhat");
const { provider, BigNumber, constants } = ethers;
const { parseEther } = ethers.utils;
const time = require("./time");

const wbtcAbi = require("../../constants/abis/WBTC.json");
const ORACLE_ABI = require("../../constants/abis/OpynOracle.json");

module.exports = {
  getDefaultArgs,
  deployProxy,
  wmul,
  wdiv,
  parseLog,
  mintAndApprove,
  setupOracle,
  setOpynOracleExpiryPrice,
  whitelistProduct,
  mintToken,
};

async function deployProxy(
  logicContractName,
  adminSigner,
  initializeTypes,
  initializeArgs,
  factoryOptions = {},
  logicDeployParams = []
) {
  const AdminUpgradeabilityProxy = await ethers.getContractFactory(
    "AdminUpgradeabilityProxy",
    adminSigner
  );
  const LogicContract = await ethers.getContractFactory(
    logicContractName,
    factoryOptions || {}
  );
  const logic = await LogicContract.deploy(...logicDeployParams);

  const initBytes = encodeCall("initialize", initializeTypes, initializeArgs);
  const proxy = await AdminUpgradeabilityProxy.deploy(
    logic.address,
    adminSigner.address,
    initBytes
  );
  return await ethers.getContractAt(logicContractName, proxy.address);
}

const ORACLE_DISPUTE_PERIOD = 7200;
const ORACLE_LOCKING_PERIOD = 300;

const ORACLE_OWNER = "0x638E5DA0EEbbA58c67567bcEb4Ab2dc8D34853FB";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.AddressZero;
const ETH_WBTC_PAIR_ADDRESS = "0xbb2b8038a1640196fbe3e38816f3e67cba72d940";

const USDCETH_PRICE_FEED = "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
const ZERO_EX_EXCHANGE_V3 = "0xDef1C0ded9bec7F1a1670819833240f027b25EfF";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const GAMMA_CONTROLLER = "0x4ccc2339F87F6c59c6893E1A678c2266cA58dC72";

const GAMMA_ORACLE = "0xc497f40D1B7db6FA5017373f1a0Ec6d53126Da23";
const GAMMA_WHITELIST = "0xa5EA18ac6865f315ff5dD9f1a7fb1d41A30a6779";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const CHARM_OPTION_VIEWS = "0x3cb5d4aeb622A72CF971D4F308e767C53be4E815";
const CHARM_OPTION_REGISTRY = "0x574467e54F1E145d0d1a9a96560a7704fEdAd1CD";

let factory, hegicAdapter, opynV1Adapter, charmAdapter, mockGammaController;

async function getDefaultArgs() {
  // ensure we just return the cached instances instead of re-initializing everything
  if (
    factory &&
    hegicAdapter &&
    opynV1Adapter &&
    gammaAdapter &&
    charmAdapter &&
    mockGammaController
  ) {
    return {
      factory,
      hegicAdapter,
      opynV1Adapter,
      charmAdapter,
      gammaAdapter,
      mockGammaController,
    };
  }

  const [adminSigner, ownerSigner] = await ethers.getSigners();
  const admin = adminSigner.address;
  const owner = ownerSigner.address;

  const HegicAdapter = await ethers.getContractFactory(
    "HegicAdapter",
    ownerSigner
  );
  const GammaAdapter = await ethers.getContractFactory(
    "GammaAdapter",
    ownerSigner
  );
  const CharmAdapter = await ethers.getContractFactory(
    "CharmAdapter",
    ownerSigner
  );
  const MockGammaController = await ethers.getContractFactory(
    "MockGammaController",
    ownerSigner
  );
  const ProtocolAdapter = await ethers.getContractFactory("ProtocolAdapter");

  factory = (
    await deployProxy(
      "RibbonFactory",
      adminSigner,
      ["address", "address"],
      [owner, admin]
    )
  ).connect(ownerSigner);

  hegicAdapter = await HegicAdapter.deploy(
    HEGIC_ETH_OPTIONS,
    HEGIC_WBTC_OPTIONS,
    ETH_ADDRESS,
    WBTC_ADDRESS,
    ETH_WBTC_PAIR_ADDRESS
  );

  mockGammaController = await MockGammaController.deploy(
    GAMMA_ORACLE,
    UNISWAP_ROUTER,
    WETH_ADDRESS
  );

  let mockGammaAdapter = await GammaAdapter.deploy(
    OTOKEN_FACTORY,
    mockGammaController.address,
    MARGIN_POOL,
    USDCETH_PRICE_FEED,
    UNISWAP_ROUTER,
    WETH_ADDRESS,
    USDC_ADDRESS,
    ZERO_EX_EXCHANGE_V3
  );

  let gammaAdapter = await GammaAdapter.deploy(
    OTOKEN_FACTORY,
    GAMMA_CONTROLLER,
    MARGIN_POOL,
    USDCETH_PRICE_FEED,
    UNISWAP_ROUTER,
    WETH_ADDRESS,
    USDC_ADDRESS,
    ZERO_EX_EXCHANGE_V3
  );

  charmAdapter = await CharmAdapter.deploy(
    CHARM_OPTION_VIEWS,
    CHARM_OPTION_REGISTRY
  );

  await factory.setAdapter("HEGIC", hegicAdapter.address, { from: owner });
  await factory.setAdapter("OPYN_GAMMA", gammaAdapter.address, { from: owner });
  await factory.setAdapter("CHARM", charmAdapter.address, { from: owner });

  const protocolAdapterLib = await ProtocolAdapter.deploy();

  return {
    factory,
    hegicAdapter,
    mockGammaAdapter,
    charmAdapter,
    gammaAdapter,
    mockGammaController,
    protocolAdapterLib,
  };
}

function wdiv(x, y) {
  return x
    .mul(parseEther("1"))
    .add(y.div(BigNumber.from("2")))
    .div(y);
}

function wmul(x, y) {
  return x
    .mul(y)
    .add(parseEther("1").div(BigNumber.from("2")))
    .div(parseEther("1"));
}

async function parseLog(contractName, log) {
  if (typeof contractName !== "string") {
    throw new Error("contractName must be string");
  }
  const abi = (await artifacts.readArtifact(contractName)).abi;
  const iface = new ethers.utils.Interface(abi);
  const event = iface.parseLog(log);
  return event;
}

async function mintAndApprove(tokenAddress, userSigner, spender, amount) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"],
  });
  const wbtcMinter = await ethers.provider.getSigner(
    "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"
  );
  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
  await forceSend.deployed();
  await forceSend.go("0xca06411bd7a7296d7dbdd0050dfc846e95febeb7", {
    value: parseEther("1"),
  });

  const WBTCToken = await ethers.getContractAt(wbtcAbi, tokenAddress);
  await WBTCToken.connect(wbtcMinter).mint(userSigner.address, amount);
  await WBTCToken.connect(userSigner).approve(
    spender,
    amount.mul(BigNumber.from("10"))
  );
  // await hre.network.provider.request({
  //   method: "hardhat_stopImpersonatingAccount",
  //   params: ["0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"]}
  // )
}

async function whitelistProduct(underlying, strike, collateral, isPut) {
  const [adminSigner] = await ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ORACLE_OWNER],
  });

  const ownerSigner = await provider.getSigner(ORACLE_OWNER);

  const whitelist = await ethers.getContractAt(
    "IGammaWhitelist",
    GAMMA_WHITELIST
  );

  await adminSigner.sendTransaction({
    to: ORACLE_OWNER,
    value: parseEther("0.5"),
  });

  await whitelist.connect(ownerSigner).whitelistCollateral(underlying);

  await whitelist
    .connect(ownerSigner)
    .whitelistProduct(underlying, strike, collateral, isPut);
}

async function setupOracle(pricerOwner, signer) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [pricerOwner],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ORACLE_OWNER],
  });
  const pricerSigner = await provider.getSigner(pricerOwner);

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
  await forceSend.connect(signer).go(pricerOwner, { value: parseEther("0.5") });

  const oracle = new ethers.Contract(GAMMA_ORACLE, ORACLE_ABI, pricerSigner);

  const oracleOwnerSigner = await provider.getSigner(ORACLE_OWNER);

  await signer.sendTransaction({
    to: ORACLE_OWNER,
    value: parseEther("0.5"),
  });

  await oracle
    .connect(oracleOwnerSigner)
    .setStablePrice(USDC_ADDRESS, "100000000");

  return oracle;
}

async function setOpynOracleExpiryPrice(asset, oracle, expiry, settlePrice) {
  await time.increaseTo(parseInt(expiry) + ORACLE_LOCKING_PERIOD + 1);

  const res = await oracle.setExpiryPrice(asset, expiry, settlePrice);
  const receipt = await res.wait();
  const timestamp = (await provider.getBlock(receipt.blockNumber)).timestamp;

  await time.increaseTo(timestamp + ORACLE_DISPUTE_PERIOD + 1);
}

async function mintToken(contract, contractOwner, recipient, spender, amount) {
  const tokenOwnerSigner = await ethers.provider.getSigner(contractOwner);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [contractOwner],
  });

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // Some contract do not have receive(), so we force send
  await forceSend.deployed();
  await forceSend.go(contractOwner, {
    value: parseEther("0.5"),
  });

  if (contract.address == USDC_ADDRESS) {
    await contract
      .connect(tokenOwnerSigner)
      .transfer(recipient.address, amount);
  } else {
    await contract.connect(tokenOwnerSigner).mint(recipient.address, amount);
  }

  await contract.connect(recipient).approve(spender, amount);

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [contractOwner],
  });
}
