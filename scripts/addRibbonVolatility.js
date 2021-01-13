require("dotenv").config();
const web3 = require("./helpers/web3");
const { Command } = require("commander");
const program = new Command();

const externalAddresses = require("../constants/externalAddresses.json");
const deployments = require("../constants/deployments.json");
const accountAddresses = require("../constants/accounts.json");

// expiry 1 week from now
const defaultExpirySeconds = parseInt(
  +new Date(+new Date() + 6.048e8) / 1000,
  10
);

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "kovan")
  .option("-f, --factory <factory>", "RibbonFactory proxy address")
  .option("-n, --name <name>", "name of instrument (must be unique)")
  .option("-s, --symbol <symbol>", "symbol")
  .option("-u, --underlying <underlying>", "underlying asset")
  .option("-a, --strikeAsset <strikeAsset>", "strike asset")
  .option("-c, --collateral <collateral>", "collateral asset")
  .requiredOption(
    "-e, --expiry <time>",
    "defaults to current day + 1 week",
    defaultExpirySeconds
  );

program.parse(process.argv);

async function addDojiVolatility() {
  const {
    instrumentName,
    symbol,
    expiry,
    strikePrice,
    underlying,
    strikeAsset,
  } = program;
}
