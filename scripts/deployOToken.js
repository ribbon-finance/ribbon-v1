require("dotenv").config();
const getWeb3 = require("./helpers/web3");
const { Command } = require("commander");
const program = new Command();

const externalAddresses = require("../constants/externalAddresses");
const accountAddresses = require("../constants/accounts.json");
const oTokenFactoryABI = require("../constants/abis/OtokenFactory.json");
const { sleep } = require("@openzeppelin/upgrades");
const getGasPrice = require("./helpers/getGasPrice");

const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";

program.version("0.0.1");
program
  .option(
    "-u, --underlying <underlying>",
    "Underlying",
    externalAddresses.mainnet.assets.weth
  )
  .option(
    "-s, --strikeAsset <strikeAsset>",
    "Strike asset",
    externalAddresses.mainnet.assets.usdc
  )
  .option(
    "-c, --collateralAsset <collateralAsset>",
    "Collateral asset",
    externalAddresses.mainnet.assets.weth
  )
  .requiredOption("-x, --strikePrice <strikePrice>", "Strike price")
  .requiredOption("-e, --expiry <expiry>", "Expiry")
  .option("-p, --isPut", "Is put", false);

program.parse(process.argv);

async function deployOToken() {
  const web3 = await getWeb3();

  const {
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
  } = program;

  const factory = new web3.eth.Contract(oTokenFactoryABI, OTOKEN_FACTORY);

  const gasPrice = await getGasPrice();
  console.log(`Gas price: ${gasPrice.toString()}`);

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
      from: accountAddresses.mainnet.owner,
      gasPrice,
    });
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  sleep(60000);

  process.exit(0);
}

deployOToken();
