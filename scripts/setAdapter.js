const { Command } = require("commander");
const getWeb3 = require("./helpers/web3");
const deployments = require("../constants/deployments.json");
const accounts = require("../constants/accounts.json");
const factoryJSON = require("../build/contracts/RibbonFactory.json");
const getGasPrice = require("./helpers/getGasPrice");
const program = new Command();

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "mainnet-sim")
  .requiredOption("-n, --adapterName <name>", "Adapter name")
  .requiredOption("-a, --adapterAddress <adapter>", "Adapter address");

program.parse(process.argv);

async function setAdapter() {
  const { adapterName, adapterAddress, network } = program;
  const web3 = getWeb3(network);

  const gasPrice = await getGasPrice();
  const { owner } = accounts[network];
  const factoryAddress = deployments[network].RibbonFactory;
  const factory = new web3.eth.Contract(factoryJSON.abi, factoryAddress);

  console.log("Sending transaction...");
  const receipt = await factory.methods
    .setAdapter(adapterName, adapterAddress)
    .send({
      from: owner,
      gasPrice,
      value: "0",
    });
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  process.exit(0);
}

setAdapter();
