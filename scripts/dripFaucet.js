const accounts = require("../constants/accounts.json");
const program = require("commander");
const { getFaucetDrip } = require("./helpers/getFaucetDrip");

program.requiredOption("-t, --token <address>", "token address");

program.option("-n, --network <name>", "ethereum network", "kovan");

program.option(
  "-a, --recipient <address>",
  "receipient address to receive funds from faucet",
  accounts[program.network].owner
);

program.parse(process.argv);

(async function () {
  console.log(
    `Contacting faucet to fund ${program.recipient} with token ${program.token}`
  );
  const receipt = await getFaucetDrip(program.token, program.recipient);
  console.log(`Txhash: ${receipt.transactionHash}`);

  process.exit();
})();
