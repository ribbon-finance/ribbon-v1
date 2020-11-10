require("dotenv").config();
const web3 = require("./helpers/web3");
const { Command } = require("commander");
const program = new Command();

const externalAddresses = require("../constants/externalAddresses.json");
const deployments = require("../constants/deployments.json");
const accountAddresses = require("../constants/accounts.json");
const { newTwinYield } = require("./helpers/newInstrument");

// expiry 1 week from now
const defaultExpirySeconds = parseInt(
  +new Date(+new Date() + 6.048e8) / 1000,
  10
);

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "kovan")
  .requiredOption("-x, --strikePrice <strike>", "strike", parseInt)
  .requiredOption(
    "-e, --expiry <time>",
    "defaults to current day + 1 week",
    defaultExpirySeconds
  )
  .option("-n, --instrumentName <name>", "name of instrument (must be unique)")
  .option("-s, --symbol <symbol>", "symbol")
  .option(
    "-m, --collateralizationRatio <collatratio>",
    "defaults to 100%",
    "1000000000000000000"
  )
  .option(
    "-c, --collateralAsset <address>",
    "collateral asset, defaults to WETH",
    externalAddresses.kovan.assets.weth
  )
  .option(
    "-t, --targetAsset <address>",
    "target asset, defaults to WETH",
    externalAddresses.kovan.assets.weth
  )
  .option(
    "-p, --paymentToken <address>",
    "payment token, defaults to WETH",
    externalAddresses.kovan.assets.weth
  )
  .option(
    "-l, --liquidatorProxy <address>",
    "liquidator proxy",
    deployments.kovan.LiquidatorProxy
  )
  .option(
    "-b, --balancerFactory <address>",
    "core balancer pool factory",
    externalAddresses.kovan.balancerFactory
  );

program.parse(process.argv);

(async function () {
  const {
    instrumentName,
    symbol,
    expiry,
    strikePrice,
    collateralizationRatio,
    collateralAsset,
    targetAsset,
    paymentToken,
    liquidatorProxy,
    balancerFactory,
  } = program;

  const expiryDate = new Date(program.expiry * 1000);
  const expiryInName = expiryDate.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const expiryInSymbol = expiryInName.replace(/\//g, "");

  const defaultName = `TwinYield ETH-USD ${strikePrice} ${expiryInName}`;
  const defaultSymbol = `TY-ETHUSD-${strikePrice}-${expiryInSymbol}`;

  const opts = {
    owner: accountAddresses.kovan.owner,
    dataProvider: deployments.kovan.DataProvider,
    name: instrumentName || defaultName,
    symbol: symbol || defaultSymbol,
    expiry: parseInt(expiry),
    strikePrice: web3.utils.toWei(program.strikePrice.toString(), "ether"),
    collateralizationRatio,
    collateralAsset,
    targetAsset,
    paymentToken,
    liquidatorProxy,
    balancerFactory,
  };
  console.log("Deploying with parameters:");
  console.log(opts);

  try {
    await newTwinYield(web3, opts);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();
