require("dotenv").config();

const web3 = require("./helpers/web3");
var dataProviderJSON = require("../build/contracts/DataProvider.json");
const deployments = require("../constants/deployments.json");
const externalAddresses = require("../constants/externalAddresses.json");
const accountAddresses = require("../constants/accounts.json");

async function addAssetFeed(asset, feed) {
  const dataProviderAddress = deployments.kovan.DataProvider;
  const adminAddress = accountAddresses.kovan.admin;

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
  const dataProviderAddress = deployments.kovan.DataProvider;
  const adminAddress = accountAddresses.kovan.admin;

  const contract = new web3.eth.Contract(
    dataProviderJSON.abi,
    dataProviderAddress
  );
  const result = await contract.methods.getChainlinkFeed(asset).call({
    from: adminAddress,
  });
  console.log(result);
}

async function main() {
  const usdc = externalAddresses.kovan.assets.usdc;
  const ethUSDFeed = externalAddresses.kovan.feeds["eth/usd"];

  // await addAssetFeed(usdc, ethUSDFeed);
  // await getFeed(usdc);
  await addAssetFeed(externalAddresses.kovan.assets.weth, ethUSDFeed);
  // await addAssetFeed(externalAddresses.kovan.assets.dai, ethUSDFeed);
  await getFeed(externalAddresses.kovan.assets.weth);
  // await getFeed(link);

  process.exit();
}

main();
