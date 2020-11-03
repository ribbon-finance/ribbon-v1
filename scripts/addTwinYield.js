require("dotenv").config();
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { Command } = require("commander");
const program = new Command();

const externalAddresses = require("../constants/externalAddresses.json");
const deployments = require("../constants/deployments.json");
const { newTwinYield } = require("./newInstrument");

// expiry 1 week from now
const defaultExpirySeconds = parseInt(
  +new Date(+new Date() + 6.048e8) / 1000,
  10
);

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "kovan")
  .option("-n, --instrumentName <name>", "name of instrument (must be unique)")
  .option("-s, --symbol <symbol>", "symbol")
  .requiredOption("-x, --strike <strike>", "strike")
  .option(
    "-e, --expiry <time>",
    "defaults to current day + 1 week",
    defaultExpirySeconds
  )
  .option(
    "-m, --collatratio <collatratio>",
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
  const expiryDate = new Date(program.expiry * 1000);
  const expiryInName = `${expiryDate.getDay()}/${expiryDate.getMonth()}/${expiryDate
    .getFullYear()
    .toString()
    .substr(-2)}`;
  const expiryInSymbol = expiryInName.replace("/", "");

  const opts = {
    dataProvider: deployments.kovan.DataProvider,
    name: program.instrumentName || `TwinYield ETH-USDC ${expiryInName}`,
    symbol: program.symbol || `TY-ETHUSDC-${expiryInSymbol}`,
    expiry: program.expiry,
    strikePrice: program.strike,
    collateralizationRatio: program.collatratio,
    collateralAsset: program.collateralAsset,
    targetAsset: program.targetAsset,
    paymentToken: program.paymentToken,
    liquidatorProxy: program.liquidatorProxy,
    balancerFactory: program.balancerFactory,
  };

  await newTwinYield(opts);

  // newTwinYield({expiry
  //   dataProvider: deployments.kovan.DataProvider,
  //   name,
  //   symbol,
  //   expiry: program.expiry,
  //   strikePrice: program.strike,
  //   collateralizationRatio: program.collatratio,
  // });

  try {
    const provider = new HDWalletProvider(
      process.env.MNEMONIC,
      process.env.INFURA_KOVAN_URI
    );
    const web3 = new Web3(
      new Web3.providers.HttpProvider(process.env.INFURA_KOVAN_URI)
    );
  } catch (e) {
    console.error(e);
  }
  process.exit(1);
})();
