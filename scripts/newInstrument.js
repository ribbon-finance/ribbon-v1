const { encodeCall } = require("@openzeppelin/upgrades");
const { updateDeployedAddresses } = require("./updateDeployedAddresses");

module.exports = {
  newTwinYield,
};

async function newTwinYield({
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
  console.log(initData);
}
