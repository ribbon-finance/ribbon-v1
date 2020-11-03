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
  .requiredOption("-x, --strikePrice <strike>", "strike")
  .option(
    "-e, --expiry <time>",
    "defaults to current day + 1 week",
    defaultExpirySeconds
  );

const expiryDate = new Date(program.expiry * 1000);
const expiryInName = `${expiryDate.getDay()}/${expiryDate.getMonth()}/${expiryDate
  .getFullYear()
  .toString()
  .substr(-2)}`;
const expiryInSymbol = expiryInName.replace("/", "");

const defaultName = `TwinYield ETH-USDC ${expiryInName}`;
const defaultSymbol = `TY-ETHUSDC-${expiryInSymbol}`;

program
  .option(
    "-n, --instrumentName <name>",
    "name of instrument (must be unique)",
    defaultName
  )
  .option("-s, --symbol <symbol>", "symbol", defaultSymbol)
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
    instrumentName: name,
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

  const opts = {
    dataProvider: deployments.kovan.DataProvider,
    name,
    symbol,
    expiry,
    strikePrice,
    collateralizationRatio,
    collateralAsset,
    targetAsset,
    paymentToken,
    liquidatorProxy,
    balancerFactory,
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
