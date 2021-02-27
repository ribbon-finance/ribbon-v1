require("dotenv").config();
const getWeb3 = require("./helpers/web3");
const { constants } = require("@openzeppelin/test-helpers");
const { Command } = require("commander");
const program = new Command();

const deployments = require("../constants/deployments");
const externalAddresses = require("../constants/externalAddresses");
const accountAddresses = require("../constants/accounts.json");

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
  const {
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
  } = program;
  console.log({
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
  });
}
deployOToken();
