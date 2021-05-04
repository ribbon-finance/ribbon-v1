import { ethers } from "ethers";
import { Command } from "commander";
import { getGasPrice } from "./helpers/getGasPrice";
import { getDefaultProvider } from "./helpers/getDefaultEthersProvider";

import externalAddresses from "../constants/externalAddresses.json";
import accountAddresses from "../constants/accounts.json";
import oTokenFactoryABI from "../constants/abis/OtokenFactory.json";

const { parseUnits } = ethers.utils;

require("dotenv").config();

const program = new Command();

program.version("0.0.1");

program.requiredOption("-n, --network <network>", "Network", "mainnet");

program
  .option("-u, --underlying <underlying>", "Underlying")
  .option("-s, --strikeAsset <strikeAsset>", "Strike asset")
  .option("-c, --collateralAsset <collateralAsset>", "Collateral asset")
  .requiredOption("-x, --strikePrice <strikePrice>", "Strike price")
  .requiredOption("-e, --expiry <expiry>", "Expiry")
  .option("-p, --isPut", "Is put", false);

program.parse(process.argv);

async function deployOToken() {
  const network = program.network === "mainnet" ? "mainnet" : "kovan";

  const provider = getDefaultProvider(program.network);

  const web3 = await getWeb3(network);
  const owner = accountAddresses[network].owner;

  const {
    underlying = externalAddresses[network].assets.weth,
    strikeAsset = externalAddresses[network].assets.usdc,
    collateralAsset = externalAddresses[network].assets.weth,
    strikePrice,
    expiry,
    isPut,
  } = program;

  const factory = new ethers.Contract(
    externalAddresses[network].oTokenFactory,
    oTokenFactoryABI
  );

  let gasPrice;
  if (network === "mainnet") {
    gasPrice = await getGasPrice();
  } else {
    gasPrice = parseUnits("20", "gwei");
  }

  console.log(`Gas price: ${gasPrice.toString()}`);

  console.log([
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
  ]);

  const tx = await factory.createOtoken(
    underlying,
    strikeAsset,
    collateralAsset,
    strikePrice,
    expiry,
    isPut,
    {
      from: owner,
      gasPrice,
    }
  );
  console.log("Txhash: " + tx.hash);
  await tx.wait(1);

  process.exit(0);
}

deployOToken();
