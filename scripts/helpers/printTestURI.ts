require("dotenv").config();

async function main() {
  console.log(process.env.MAINNET_URI);
  process.exit();
}
main();
