require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const json = require("../addresses.json");
const factoryProxy = require("../build/contracts/DojimaFactory.json");
const path = require("path");
const fs = require("fs");

const { verifyEtherscan } = require("./etherscanHelpers");

const newInstrumentABI = [
  { type: "string", name: "name" },
  { type: "address", name: "instrumentAddress" },
  { type: "address", name: "dTokenAddress" },
];

console.log("Reading solidity source");
const filepath = path.join(__dirname, "InstrumentFlattened.sol");

const exists = fs.existsSync(filepath);
if (!exists) {
  console.log("File doesnt exist");
}
const source = fs.readFileSync(filepath).toString();
console.log("Done reading");

async function addInstrument(name, symbol, expiry, CR, colAsset, targetAsset) {
  const factoryProxyAddress = json["contracts"]["adminUpgradeabilityProxy"];
  const ownerAddress = json["accounts"]["owner"];
  const contract = new web3.eth.Contract(factoryProxy.abi, factoryProxyAddress);

  var txhash;
  var instrumentAddress;
  var dTokenAddress;

  await contract.methods
    .newInstrument(name, symbol, expiry, CR, colAsset, targetAsset)
    .send({
      from: ownerAddress,
      gasPrice: "10000000000", // 10 Gwei
      gasLimit: "5000000", // 5m gas limit
      value: "0",
    })
    .on("transactionHash", function (hash) {
      console.log("Txhash: ", hash);
      txhash = hash;
    });

  const receipt = await web3.eth.getTransactionReceipt(txhash);
  const logs = receipt["logs"][1]["data"];
  const res = await web3.eth.abi.decodeParameters(newInstrumentABI, logs);
  instrumentAddress = res["instrumentAddress"];
  dTokenAddress = res["dTokenAddress"];

  const dataProvider = await contract.methods
    .dataProvider()
    .call({ from: ownerAddress });
  const liquidatorProxy = await contract.methods
    .liquidatorProxy()
    .call({ from: ownerAddress });

  return [instrumentAddress, dTokenAddress, dataProvider, liquidatorProxy];
}

async function timeout(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

module.exports = async function (done) {
  try {
    const provider = new HDWalletProvider(
      process.env.MNEMONIC,
      process.env.INFURA_KOVAN_URI
    );
    web3.setProvider(provider);

    const name = "ETH-backed Dai 17/11/20";
    const symbol = "ETHdDai-1117";
    const expiry = "1605571200";
    const CR = "1500000000000000000";
    const colAsset = json["assets"]["eth"];
    const targetAsset = json["assets"]["dai"];
    // const dataProvider = "0x3e85c772cdcd3861Acdd7cd1e66B92502126Efc4";
    // const liquidatorProxy = "0x5c12B718f26e59d01197349170c51f33e73FD9bb";
    // const instrumentAddress = "0x1fee9141Df621aE25b74Bc824571b1F54E8E3147";

    const [
      instrumentAddress,
      _,
      dataProvider,
      liquidatorProxy,
    ] = await addInstrument(name, symbol, expiry, CR, colAsset, targetAsset);

    console.log("Waiting to complete deploy");
    await timeout(10000);

    const constructorArgs = web3.eth.abi
      .encodeParameters(
        [
          "address",
          "string",
          "string",
          "uint256",
          "uint256",
          "address",
          "address",
          "address",
        ],
        [
          dataProvider,
          name,
          symbol,
          expiry,
          CR,
          colAsset,
          targetAsset,
          liquidatorProxy,
        ]
      )
      .slice(2);

    console.log("Instrument address " + instrumentAddress);
    console.log("Constructor args " + constructorArgs);

    await verifyEtherscan(instrumentAddress, source, constructorArgs);
    done();
  } catch (e) {
    console.error(e);
    done();
  }

  //   instrumentAddress, dTokenAddress, dataProvider, liquidatorProxy = await addInstrument(
  //       name,
  //       symbol,
  //       expiry,
  //       CR,
  //       colAsset,
  //       targetAsset
  //   );
};
