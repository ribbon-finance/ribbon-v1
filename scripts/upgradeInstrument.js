const web3 = require("./helpers/web3");
const program = require("commander");
const deployments = require("../constants/deployments.json");
const accounts = require("../constants/accounts.json");
const AdminUpgradeabilityProxy = require("../build/contracts/AdminUpgradeabilityProxy.json");
const IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

program.option("-n, --network <name>", "ethereum network", "kovan");

program
  .requiredOption("-i, --instrument <address>", "instrument to upgrade")
  .requiredOption(
    "-l, --logic <address>",
    "new instrument implementation contract",
    deployments[program.network].TwinYieldLogic
  )
  .requiredOption(
    "-a, --admin <address>",
    "admin used to upgrade the implementation",
    accounts[program.network].admin
  );

program.parse(process.argv);

async function upgradeInstrument() {
  const proxy = new web3.eth.Contract(
    AdminUpgradeabilityProxy.abi,
    program.instrument
  );

  const currentImplementation = web3.utils.toChecksumAddress(
    "0x" +
      (await web3.eth.getStorageAt(program.instrument, IMPL_SLOT)).slice(26)
  );
  console.log(`Proxy is currently pointing to: ${currentImplementation}`);
  console.log(`Upgrading to use: ${program.logic}`);

  const receipt = await proxy.methods
    .upgradeTo(program.logic)
    .send({ from: program.admin });
  console.log(`Upgrade txhash: ${receipt.transactionHash}`);
  console.log(
    `Re-verify the instrument proxy ${program.instrument}, verify with https://kovan.etherscan.io/proxyContractChecker?a=${program.instrument}`
  );

  process.exit();
}

upgradeInstrument();
