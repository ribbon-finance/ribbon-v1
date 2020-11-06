const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { encodeCall } = require("@openzeppelin/upgrades");
const { sleep } = require("./utils");
const factoryJSON = require("../../build/contracts/DojimaFactory.json");
const accountAddresses = require("../../constants/accounts.json");
const deployedAddresses = require("../../constants/deployments");

module.exports = {
  newTwinYield,
};

function encodeTwinYieldData({
  owner,
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
    owner,
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

const InstrumentCreatedTopic =
  "0x772afdcbda650f2713223d4a9c12ba1ff2f3c819a4faea1faf64595cb9f80595";

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
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  console.log("Waiting 1 minute to complete deploy");
  await sleep(60000);

  const instrumentAddress = await getInstrumentAddress(web3, txhash);
  console.log(
    `Instrument is deployed at ${instrumentAddress}, verify with https://kovan.etherscan.io/proxyContractChecker?a=${instrumentAddress}`
  );

  await addNewInstrumentToConstants(
    "kovan",
    txhash,
    opts.expiry,
    opts.symbol,
    instrumentAddress
  );
}

async function getInstrumentAddress(
  web3,
  txhash,
  topicName = InstrumentCreatedTopic
) {
  const receipt = await web3.eth.getTransactionReceipt(txhash);

  const eventLog = receipt.logs.find((log) =>
    log.topics.find((topic) => topic === topicName)
  );
  if (!eventLog) {
    throw new Error(`No logs found with topic ${topicName}`);
  }

  const addressTopic = eventLog.topics[1];
  const instrumentAddress = "0x" + addressTopic.slice(addressTopic.length - 40);
  return instrumentAddress;
}

async function addNewInstrumentToConstants(
  network,
  txhash,
  expiry,
  instrumentSymbol,
  address
) {
  const filepath = path.normalize(
    path.join(__dirname, "..", "..", "constants", "instruments.json")
  );

  const content = await promisify(fs.readFile)(filepath);
  const instrumentsDeployed = JSON.parse(content.toString());

  const newInstruments = instrumentsDeployed[network].concat([
    {
      txhash,
      expiry,
      instrumentSymbol,
      address,
    },
  ]);

  const reverseSortedInstruments = newInstruments.sort((insA, insB) => {
    if (insA.expiry > insB.expiry) {
      return -1;
    } else if (insA.expiry < insB.expiry) {
      return 1;
    }
    return 0;
  });

  instrumentsDeployed[network] = reverseSortedInstruments;

  await promisify(fs.writeFile)(
    filepath,
    JSON.stringify(instrumentsDeployed, null, "\t") + "\n"
  );
}
