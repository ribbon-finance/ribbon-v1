import { Command } from "commander";
import { encodeCommitAndClose } from "./helpers/encodeCommitAndClose";

const program = new Command();
program.version("0.0.1");
program
  .requiredOption("-a, --address <oTokenAddress>", "oToken address")
  .requiredOption("-n, --network <network>", "Network", "kovan");

program.parse(process.argv);

async function main() {
  await encodeCommitAndClose(program.network, program.address);
}

main();
