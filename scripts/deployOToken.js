require("dotenv").config();
const getWeb3 = require("./helpers/web3");
const { Command } = require("commander");
const { ethers } = require("ethers");
const { parseEther } = ethers.utils;
const program = new Command();

const externalAddresses = require("../constants/externalAddresses");
const accountAddresses = require("../constants/accounts.json");
const oTokenFactoryABI = require("../constants/abis/OtokenFactory.json");
const { sleep } = require("@openzeppelin/upgrades");
const getGasPrice = require("./helpers/getGasPrice");
const { parseUnits } = require("ethers/lib/utils");

program.version("0.0.1");

program.requiredOption("-n, --network <network>", "Network", "kovan");

program
  .option(
    "-u, --underlying <underlying>",
    "Underlying",
    externalAddresses[program.network].assets.weth
  )
  .option(
    "-s, --strikeAsset <strikeAsset>",
    "Strike asset",
    externalAddresses[program.network].assets.usdc
  )
  .option(
    "-c, --collateralAsset <collateralAsset>",
    "Collateral asset",
    externalAddresses[program.network].assets.weth
  )
  .requiredOption("-x, --strikePrice <strikePrice>", "Strike price")
  .requiredOption("-e, --expiry <expiry>", "Expiry")
  .option("-p, --isPut", "Is put", false);

program.parse(process.argv);

async function deployOToken() {
  const network = program.network;
  const web3 = await getWeb3(network);
  const owner = accountAddresses[network].owner;

  const {
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
  } = program;

  const factory = new web3.eth.Contract(
    oTokenFactoryABI,
    externalAddresses[network].oTokenFactory
  );

  let gasPrice;
  if (network === "mainnet") {
    gasPrice = await getGasPrice();
  } else {
    gasPrice = parseUnits("20", "gwei");
  }

  console.log(`Gas price: ${gasPrice.toString()}`);

  console.log([
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
  ]);

  const receipt = await factory.methods
    .createOtoken(
      underlying,
      strikeAsset,
      collateralAsset,
      strikePrice,
      expiry,
      isPut
    )
    .send({
      from: owner,
      gasPrice,
    });
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  sleep(60000);

  process.exit(0);
}

deployOToken();
