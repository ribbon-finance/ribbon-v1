const { encodeCall } = require("@openzeppelin/upgrades");
const { updateDeployedAddresses } = require("./updateDeployedAddresses");
const factoryJSON = require("../build/contracts/DojimaFactory.json");

const accountAddresses = require("../constants/accounts.json");
const deployedAddresses = require("../constants/deployments");

module.exports = {
  newTwinYield,
};

function encodeTwinYieldData({
  dataProvider,
  name,
  symbol,
  expiry,
  strikePrice,
  collateralizationRatio,
  collateralAsset,
  targetAsset,
  paymentToken,
  liquidatorProxy,
  balancerFactory,
}) {
  const newInstrumentTypes = [
    "address",
    "string",
    "string",
    "uint256",
    "uint256",
    "uint256",
    "address",
    "address",
    "address",
    "address",
    "address",
  ];
  const newInstrumentArgs = [
    dataProvider,
    name,
    symbol,
    expiry,
    strikePrice,
    collateralizationRatio,
    collateralAsset,
    targetAsset,
    paymentToken,
    liquidatorProxy,
    balancerFactory,
  ];
  const initData = encodeCall(
    "initialize",
    newInstrumentTypes,
    newInstrumentArgs
  );
  return initData;
}

async function newTwinYield(web3, opts) {
  const factory = new web3.eth.Contract(
    factoryJSON.abi,
    deployedAddresses.kovan.DojimaFactory
  );

  const initData = encodeTwinYieldData(opts);
  const logic = deployedAddresses.kovan.TwinYieldLogic;
  const owner = accountAddresses.kovan.owner;

  const receipt = await factory.methods.newInstrument(logic, initData).send({
    from: owner,
    gasPrice: "10000000000", // 10 Gwei
    gasLimit: "8000000", // 5m gas limit
    value: "0",
  });
  console.log("Txhash: " + receipt.transactionHash);
}
