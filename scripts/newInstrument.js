const { encodeCall } = require("@openzeppelin/upgrades");
const { updateDeployedAddresses } = require("./updateDeployedAddresses");
const { contract } = require("@openzeppelin/test-environment");
const Factory = contract.fromArtifact("DojimaFactory");

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

async function newTwinYield(opts) {
  const initData = encodeTwinYieldData(opts);
  const factory = await Factory.at(deployedAddresses.kovan.DojimaFactory);
  await factory.newInstrument(deployedAddresses.kovan.TwinYieldLogic, initData);
}
