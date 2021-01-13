require("dotenv").config();
const getWeb3 = require("./helpers/web3");
const { constants } = require("@openzeppelin/test-helpers");
const { Command } = require("commander");
const program = new Command();

const deployments = require("../constants/deployments");
const accountAddresses = require("../constants/accounts.json");
const { newRibbonVolatility } = require("./helpers/newInstrument");

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "mainnet-sim")
  .requiredOption(
    "-n, --instrumentName <instrumentName>",
    "name of instrument (must be unique)"
  )
  .requiredOption("-s, --symbol <symbol>", "symbol")
  .option(
    "-u, --underlying <underlying>",
    "underlying asset, defaults to ETH",
    constants.ZERO_ADDRESS
  )
  .option(
    "-a, --strikeAsset <strikeAsset>",
    "strike asset, defaults to usdc",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  )
  .option(
    "-c, --collateralAsset <collateralAsset>",
    "collateral asset, defaults to ETH",
    constants.ZERO_ADDRESS
  )
  .requiredOption("-e, --expiry <time>", "expiry of the contract");

program.parse(process.argv);

let web3;

async function addRibbonVolatility() {
  const {
    network,
    instrumentName,
    symbol,
    expiry,
    underlying,
    strikeAsset,
    collateralAsset,
  } = program;

  web3 = getWeb3(network);
  const factory = deployments[network].RibbonFactory;
  const owner = accountAddresses[network].owner;

  const opts = {
    factory,
    owner,
    name: instrumentName,
    symbol,
    expiry,
    underlying,
    strikeAsset,
    collateralAsset,
  };

  await newRibbonVolatility(web3, network, opts);

  process.exit(0);
}

addRibbonVolatility();
