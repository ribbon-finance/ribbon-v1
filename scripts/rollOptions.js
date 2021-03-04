require("dotenv").config();
const getWeb3 = require("./helpers/web3");
const { Command } = require("commander");
const { sleep } = require("@openzeppelin/upgrades");
const program = new Command();

const OtokenInterface = require("../build/contracts/OtokenInterface.json");
const RibbonETHCoveredCall = require("../build/contracts/RibbonETHCoveredCall.json");
const GammaAdapter = require("../build/contracts/GammaAdapter.json");
const deployments = require("../constants/deployments");
const accountAddresses = require("../constants/accounts.json");
const getGasPrice = require("./helpers/getGasPrice");

program.version("0.0.1");
program.requiredOption("-a, --address <address>", "OToken address");

program.parse(process.argv);

async function rollOptions() {
  const web3 = await getWeb3();
  const { BN } = web3.utils;
  const { address } = program;
  const otoken = new web3.eth.Contract(OtokenInterface.abi, address);

  const underlying = await otoken.methods.underlyingAsset().call();
  const strikeAsset = await otoken.methods.strikeAsset().call();
  const collateral = await otoken.methods.collateralAsset().call();
  const expiry = await otoken.methods.expiryTimestamp().call();
  const strikePrice = new BN(await otoken.methods.strikePrice().call())
    .mul(new BN("10").pow(new BN("10")))
    .toString();
  const optionType = (await otoken.methods.isPut().call()) ? 1 : 2;
  const paymentToken = underlying;
  const gasPrice = await getGasPrice();

  const vault = new web3.eth.Contract(
    RibbonETHCoveredCall.abi,
    deployments.mainnet.RibbonETHCoveredCall
  );

  const optionTerms = [
    underlying,
    strikeAsset,
    collateral,
    expiry,
    strikePrice,
    optionType,
    paymentToken,
  ];
  console.log(optionTerms);

  const gammaAdapter = new web3.eth.Contract(
    GammaAdapter.abi,
    deployments.mainnet.GammaAdapterLogic
  );

  const otokenAddress = await gammaAdapter.methods
    .getOptionsAddress(optionTerms)
    .call();
  console.log(`Matched with oToken ${otokenAddress}`);

  const receipt = await vault.methods.rollToNextOption(optionTerms).send({
    from: accountAddresses.mainnet.owner,
    gasPrice,
  });

  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  sleep(60000);

  process.exit(0);
}

rollOptions();
