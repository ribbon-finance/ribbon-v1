require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");
var json = require("../addresses.json");
var dataProviderJSON = require("../build/contracts/DataProvider.json");
const ADDRESSES = require("../constants/externalAddresses.json");

async function addAssetFeed(asset, feed) {
  const dataProviderAddress = json["contracts"]["dataProvider"];
  const adminAddress = json["accounts"]["admin"];

  const contract = new web3.eth.Contract(
    dataProviderJSON.abi,
    dataProviderAddress
  );
  await contract.methods.addChainlinkFeed(asset, feed).send(
    {
      from: adminAddress,
      gasPrice: "10000000000", // 10 Gwei
      gasLimit: "80000", // 80k gas limit
      value: "0",
    },
    function (error, transactionHash) {
      console.log("Txhash: ", transactionHash);
    }
  );
}

async function getFeed(asset) {
  const dataProviderAddress = json["contracts"]["dataProvider"];
  const adminAddress = json["accounts"]["admin"];

  const contract = new web3.eth.Contract(
    dataProviderJSON.abi,
    dataProviderAddress
  );
  await contract.methods.getChainlinkFeed(asset).call(
    {
      from: adminAddress,
    },
    function (error, result) {
      console.log(result);
    }
  );
}

module.exports = async function (done) {
  const provider = new HDWalletProvider(
    process.env.MNEMONIC,
    process.env.INFURA_KOVAN_URI
  );
  web3.setProvider(provider);

  const usdc = ADDRESSES.kovan.assets.usdc;
  const usdcFeed = ADDRESSES.kovan.feeds["eth/usd"];

  await addAssetFeed(usdc, usdcFeed);
  await getFeed(usdc);
  // await getFeed(link);

  done();
};
