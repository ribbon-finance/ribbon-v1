require("dotenv").config();
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { Command } = require("commander");
const program = new Command();

const externalAddresses = require("../constants/externalAddresses.json");
const deployments = require("../constants/deployments.json");
const accountAddresses = require("../constants/accounts.json");
const { newTwinYield } = require("./newInstrument");

// expiry 1 week from now
const defaultExpirySeconds = parseInt(
  +new Date(+new Date() + 6.048e8) / 1000,
  10
);

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "kovan")
  .requiredOption("-x, --strikePrice <strike>", "strike")
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
    "payment token, defaults to USDC",
    externalAddresses.kovan.assets.usdc
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

  const defaultName = `TwinYield ETH-USDC ${strikePrice} ${expiryInName}`;
  const defaultSymbol = `TY-ETHUSDC-${strikePrice}-${expiryInSymbol}`;

  const opts = {
    owner: accountAddresses.kovan.owner,
    dataProvider: deployments.kovan.DataProvider,
    name: instrumentName || defaultName,
    symbol: symbol || defaultSymbol,
    expiry,
    strikePrice,
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
    const provider = new HDWalletProvider(
      process.env.MNEMONIC,
      process.env.INFURA_KOVAN_URI
    );
    const web3 = new Web3(
      new Web3.providers.HttpProvider(process.env.INFURA_KOVAN_URI)
    );
    web3.setProvider(provider);
    await newTwinYield(web3, opts);
  } catch (e) {
    console.error(e);
  }
  process.exit(1);
})();
