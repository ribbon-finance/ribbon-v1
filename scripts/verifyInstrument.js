const program = require("commander");

const { verifyEtherscan } = require("./etherscanHelpers");

program.version("0.0.1");

program
  .requiredOption(
    "-i, --instrument <address>",
    "contract address of the instrument"
  )
  .requiredOption("-d, --data <data>", "constructor used for the instrument")
  .option(
    "-n, --contractName <name>",
    "contract name e.g. TwinYield.sol",
    "TwinYield.sol"
  );

program.parse(process.argv);

(async function command() {
  await verifyEtherscan(program.instrument, program.contractName, program.data);
})();
