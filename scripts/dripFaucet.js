const accounts = require("../constants/accounts.json");
const program = require("commander");
const { getFaucetDrip } = require("./helpers/getFaucetDrip");
const externalAddresses = require("../constants/externalAddresses.json");

program.requiredOption("-t, --token <name>", "token name");

program.option("-n, --network <name>", "ethereum network", "kovan");

program.option(
  "-a, --recipient <address>",
  "receipient address to receive funds from faucet",
  accounts[program.network].owner
);

program.parse(process.argv);

(async function () {
  const tokenAddress = externalAddresses[program.network].assets[program.token];
  console.log(
    `Contacting faucet to fund ${program.recipient} with token ${program.token} (${tokenAddress})`
  );
  const receipt = await getFaucetDrip(tokenAddress, program.recipient);
  console.log(`Txhash: ${receipt.transactionHash}`);

  process.exit();
})();
