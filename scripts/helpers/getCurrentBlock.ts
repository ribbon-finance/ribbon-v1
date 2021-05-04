import { getDefaultProvider } from "./getDefaultEthersProvider";

async function main() {
  const provider = getDefaultProvider("mainnet");
  const block = await provider.getBlock("latest");
  console.log(block.number);
  process.exit();
}

main();
