const { Command } = require("commander");
const getWeb3 = require("./helpers/web3");
const deployments = require("../constants/deployments.json");
const accounts = require("../constants/accounts.json");
const volatilityJSON = require("../build/contracts/RibbonVolatility.json");
const hegicOptionsJSON = require("../build/contracts/IHegicOptions.json");
const getGasPrice = require("./helpers/getMedGasPrice");
const { BN, ether } = require("@openzeppelin/test-helpers");
const { ethers } = require("hardhat");

let web3;
const program = new Command();

// For eth: `node scripts/claimRewards.js --network mainnet --asset ETH --blockNBR 0`
// For wbtc: `node scripts/claimRewards.js --network mainnet --asset WBTC --blockNBR 0`

//NOTE: for subsequent calls, make sure to make sure blockNBR = block of last call to claimRewards

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "mainnet-sim")
  .requiredOption("-a, --asset <asset>", "Name of asset we are claiming rewards for (either WBTC or ETH)")
  .requiredOption("-b, --blockNBR <blockNBR>", "Starting block number to start claiming from");

program.parse(process.argv);

async function claimRewards() {
  const { network } = program;
  web3 = getWeb3(network);

  const gasPrice = await getGasPrice();
  const { owner } = accounts[network];
  const volatilityContract = new web3.eth.Contract(volatilityJSON.abi, deployments[network].RibbonVolatilityLogic);

  const rewardsAddress = program.asset == "ETH" ? "0x7c83Ed5eeC3370CcC98FC43ce871c7416bD7B803" : "0xBae7BE4e4a5c376950B8DB86D9D0DD1BaFc7C318";
  const hegicOptionsAddress = program.asset == "ETH" ? "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2" : "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
  const hegicAdapterName = "HEGIC";
  const proxyContractAddress = "0xce797549a7025561aE60569F68419f016e97D8c5";

  var optionIDs = await getOptionIDs(hegicOptionsAddress, proxyContractAddress, program.blockNBR);

  console.log("Sending transaction...");
  const receipt = await volatilityContract.methods
    .claimRewards(hegicAdapterName, rewardsAddress, optionIDs)
    .send({
      from: owner,
      gasPrice,
      value: "0",
    });
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);
  process.exit(0);
}

async function getOptionIDs(optionsAddress, proxyContractAddress, startBlockNBR){
  const optionsContract = new web3.eth.Contract(hegicOptionsJSON.abi, optionsAddress);

  var filter = {account : proxyContractAddress};
  var optionIDs = (await optionsContract.getPastEvents('Create', { filter, fromBlock: startBlockNBR, toBlock: 'latest'})).map(a => new BN(a["returnValues"]["0"]));
  return optionIDs;
}

claimRewards();
