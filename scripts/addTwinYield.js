require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { program } = require("commander");

const externalAddresses = require("../constants/externalAddresses.json");

// expiry 1 week from now
const expirySeconds = parseInt(+new Date(+new Date() + 6.048e8) / 1000, 10);

program.version("0.0.1");
program
  .option("-N", "--network", "Ethereum network", "kovan")
  .option("-n", "--name", "name of instrument (must be unique)")
  .option("-s", "--symbol", "symbol")
  .option("-e", "--expiry", "defaults to current day + 1 week", expirySeconds)
  .option("-m", "--collatratio", "defaults to 100%", "1000000000000000000")
  .option(
    "-c",
    "--colasset",
    "collateral asset, defaults to WETH",
    externalAddresses.kovan.assets.weth
  )
  .option(
    "-t",
    "--targetasset",
    "target asset, defaults to WETH",
    externalAddresses.kovan.assets.weth
  )
  .option(
    "-p",
    "--payment",
    "payment token, defaults to USDC",
    externalAddresses.kovan.assets.usdc
  );

program.parse(process.argv);

module.exports = async function (done) {
  try {
    const provider = new HDWalletProvider(
      process.env.MNEMONIC,
      process.env.INFURA_KOVAN_URI
    );
    web3.setProvider(provider);
    done();
  } catch (e) {
    console.error(e);
    done();
  }
};
