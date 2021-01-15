const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { encodeCall } = require("@openzeppelin/upgrades");
const { sleep } = require("./utils");
const factoryJSON = require("../../build/contracts/RibbonFactory.json");
const accountAddresses = require("../../constants/accounts.json");
const deployedAddresses = require("../../constants/deployments");
const getGasPrice = require("./getGasPrice");

module.exports = {
  newRibbonVolatility,
};

function encodeRibbonVolatilityData({
  owner,
  factory,
  name,
  symbol,
  underlying,
  strikeAsset,
  collateralAsset,
  expiry,
}) {
  const types = [
    "address",
    "address",
    "string",
    "string",
    "address",
    "address",
    "address",
    "uint256",
  ];
  const args = [
    owner,
    factory,
    name,
    symbol,
    underlying,
    strikeAsset,
    collateralAsset,
    expiry,
  ];
  return encodeCall("initialize", types, args);
}

const InstrumentCreatedTopic =
  "0x772afdcbda650f2713223d4a9c12ba1ff2f3c819a4faea1faf64595cb9f80595";

async function newRibbonVolatility(web3, network, opts) {
  const factory = new web3.eth.Contract(
    factoryJSON.abi,
    deployedAddresses[network].RibbonFactory
  );

  const initData = encodeRibbonVolatilityData(opts);
  const logic = deployedAddresses[network].RibbonVolatilityLogic;
  const owner = accountAddresses[network].owner;

  const gasPrice = (await getGasPrice()).toString();
  console.log(`Using gas price: ${web3.utils.fromWei(gasPrice, "gwei")} gwei`);

  const receipt = await factory.methods.newInstrument(logic, initData).send({
    from: owner,
    gasPrice: gasPrice,
    gasLimit: "800000",
    value: "0",
  });
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  console.log("Waiting 1 minute to complete deploy");

  if (network === "mainnet-sim") {
    await sleep(1000);
  } else {
    await sleep(60000);
  }

  const instrumentAddress = await getInstrumentAddress(web3, txhash);
  console.log(
    `\nInstrument is deployed at ${instrumentAddress}, verify with https://etherscan.io/proxyContractChecker?a=${instrumentAddress}\n`
  );

  await addNewInstrumentToConstants(
    web3,
    network,
    txhash,
    opts.expiry,
    opts.symbol,
    instrumentAddress
  );
  console.log("Added new instrument to constants/instruments.json");
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
  web3,
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
      address: web3.utils.toChecksumAddress(address),
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
