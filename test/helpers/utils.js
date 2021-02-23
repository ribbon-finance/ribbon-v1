const { encodeCall } = require("@openzeppelin/upgrades");
const { ethers, artifacts } = require("hardhat");
const { BigNumber, constants } = ethers;
const { parseEther } = ethers.utils;

module.exports = {
  getDefaultArgs,
  deployProxy,
  wmul,
  wdiv,
  parseLog,
  mintAndApprove,
};

async function deployProxy(
  logicContractName,
  adminSigner,
  initializeTypes,
  initializeArgs
) {
  const AdminUpgradeabilityProxy = await ethers.getContractFactory(
    "AdminUpgradeabilityProxy",
    adminSigner
  );
  const LogicContract = await ethers.getContractFactory(logicContractName);
  const logic = await LogicContract.deploy();

  const initBytes = encodeCall("initialize", initializeTypes, initializeArgs);
  const proxy = await AdminUpgradeabilityProxy.deploy(
    logic.address,
    adminSigner.address,
    initBytes
  );
  return await ethers.getContractAt(logicContractName, proxy.address);
}

const CHI_ADDRESS = "0x0000000000004946c0e9F43F4Dee607b0eF1fA1c";
const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.AddressZero;
const ETH_WBTC_PAIR_ADDRESS = "0xbb2b8038a1640196fbe3e38816f3e67cba72d940";

const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const GAMMA_ORACLE = "0xc497f40D1B7db6FA5017373f1a0Ec6d53126Da23";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let factory, hegicAdapter, opynV1Adapter, gammaAdapter;

async function getDefaultArgs() {
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

  const [adminSigner, ownerSigner] = await ethers.getSigners();
  const admin = adminSigner.address;
  const owner = ownerSigner.address;

  const Factory = await ethers.getContractFactory("RibbonFactory", owner);
  const HegicAdapter = await ethers.getContractFactory(
    "HegicAdapter",
    ownerSigner
  );
  const GammaAdapter = await ethers.getContractFactory(
    "GammaAdapter",
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

  gammaAdapter = await GammaAdapter.deploy(
    OTOKEN_FACTORY,
    mockGammaController.address,
    WETH_ADDRESS,
    ZERO_EX_EXCHANGE,
    UNISWAP_ROUTER
  );

  // await mintGasTokens(admin, factory.address);

  await factory.setAdapter("HEGIC", hegicAdapter.address, { from: owner });
  await factory.setAdapter("OPYN_GAMMA", gammaAdapter.address, { from: owner });

  const protocolAdapterLib = await ProtocolAdapter.deploy();

  return {
    factory,
    hegicAdapter,
    gammaAdapter,
    mockGammaController,
    protocolAdapterLib,
  };
}

async function mintGasTokens(minter, factoryAddress) {
  const chiToken = await ChiToken.at(CHI_ADDRESS);
  const mintAmount = 200;
  const receipt = await chiToken.mint(mintAmount, {
    from: minter,
    gas: 8000000,
  });
  await chiToken.transfer(factoryAddress, mintAmount, {
    from: minter,
  });
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
    params: ["0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"]}
  )
  const wbtcMinter = await ethers.provider.getSigner("0xca06411bd7a7296d7dbdd0050dfc846e95febeb7")
  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function) 
  await forceSend.deployed();
  await forceSend.go("0xca06411bd7a7296d7dbdd0050dfc846e95febeb7", { value: parseEther("1") });
  const wbtcAbi = [{"constant":true,"inputs":[],"name":"mintingFinished","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"}],"name":"reclaimToken","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"mint","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"claimOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}],"name":"decreaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"finishMinting","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}],"name":"increaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[],"name":"Pause","type":"event"},{"anonymous":false,"inputs":[],"name":"Unpause","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"burner","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[],"name":"MintFinished","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"}],"name":"OwnershipRenounced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}];
  
  const WBTCToken = await ethers.getContractAt(wbtcAbi, tokenAddress);
  await WBTCToken.connect(wbtcMinter).mint(userSigner.address, amount);
  await WBTCToken.connect(userSigner).approve(spender, amount.mul(BigNumber.from("10")))
  // await hre.network.provider.request({
  //   method: "hardhat_stopImpersonatingAccount",
  //   params: ["0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"]}
  // )
}
