const getWeb3 = require("./helpers/web3");
const { Command } = require("commander");
const instrumentJSON = require("../build/contracts/RibbonVolatility.json");
const instrumentsDeployed = require("../constants/instruments.json");

const program = new Command();

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "mainnet-sim")
  .requiredOption("-i, --instrument <instrument>", "Instrument address");

program.parse(process.argv);

async function buyInstrument() {
  const { network } = program;
  const web3 = getWeb3(network);

  const instrumentAddresses = instrumentsDeployed[network];
  const instrumentDetails = instrumentAddresses.find(
    (i) => i.address === program.instrument
  );
  if (!instrumentDetails) {
    throw new Error(`No instrument with address ${instrumentAddress} found`);
  }

  const instrument = new web3.eth.Contract(
    instrumentJSON.abi,
    instrumentDetails.address
  );
  console.log(await instrument.methods.name().call());
  console.log(await instrument.methods.symbol().call());
  process.exit(0);
}

buyInstrument();
