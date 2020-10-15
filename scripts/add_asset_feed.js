require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");
var json = require("../addresses.json");
var dataProviderJSON = require("../build/contracts/DataProvider.json");

async function addAssetFeed(asset, feed) {
  const dataProviderAddress = json["contracts"]["dataProvider"];
  const adminAddress = json["accounts"]["admin"];

  const contract = new web3.eth.Contract(dataProviderJSON.abi, dataProviderAddress);
  await contract.methods
    .addChainlinkFeed(asset, feed)
    .send({ 
      from: adminAddress,
      gasPrice: "10000000000", // 10 Gwei
      gasLimit: "80000", // 80k gas limit
      value: "0"
    }, function (error, transactionHash) {
      console.log("Txhash: ", transactionHash);
    });
}

async function getFeed(asset) {
  const dataProviderAddress = json["contracts"]["dataProvider"];
  const adminAddress = json["accounts"]["admin"];

  const contract = new web3.eth.Contract(dataProviderJSON.abi, dataProviderAddress);
  await contract.methods
    .getChainlinkFeed(asset)
    .call({ 
      from: adminAddress,
    }, function (error, result) {
      console.log(result);
    });
}

module.exports = async function (done) {
  const provider = new HDWalletProvider(
    process.env.MNEMONIC,
    process.env.INFURA_KOVAN_URI
  );
  web3.setProvider(provider);

  const dai = "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa";
  const daiFeed = "0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541"
  const link = "0xa36085f69e2889c224210f603d836748e7dc0088"
  const linkFeed = "0x3Af8C569ab77af5230596Acf0E8c2F9351d24C38";

  await addAssetFeed(link, linkFeed);
  // await getFeed(dai);
  // await getFeed(link);

  done();
};
