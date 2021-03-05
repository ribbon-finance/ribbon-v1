require("dotenv").config();
import { signOrderForSwap } from "../src/airswap/signature";
import { Command } from "commander";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import vaultJSON from "../build/contracts/RibbonETHCoveredCall.json";

const getWeb3 = require("./helpers/web3");

const program = new Command();
program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "mainnet")
  .option(
    "-m, --manager <manager>",
    "HD path to the manager key",
    "m/44'/60'/0'/0/1"
  )
  .requiredOption("-v, --vault <vault>", "Address of vault")
  .requiredOption(
    "-c, --counterparty <counterparty>",
    "Address of counterparty"
  )
  .requiredOption("-b, --buyAmount <buyAmount>", "Amount of asset to buy")
  .requiredOption("-s, --sellAmount <sellAmount>", "Amount of otokens to sell");

program.parse(process.argv);

async function signAirswapOrder() {
  const web3 = await getWeb3();
  const {
    vault: vaultAddress,
    counterparty: counterpartyAddress,
    buyAmount,
    sellAmount,
    manager,
  } = program;

  const vaultContract = new web3.eth.Contract(vaultJSON.abi, vaultAddress);

  const buyToken = await vaultContract.methods.asset().call();
  const sellToken = await vaultContract.methods.currentOption().call();
  const otoken = new web3.eth.Contract(
    [
      {
        inputs: [],
        name: "symbol",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    sellToken
  );
  const otokenSymbol = (await otoken.methods.symbol().call()).replace(
    /\//g,
    "-"
  );

  const mnemonic = process.env["MNEMONIC"];

  if (!mnemonic) {
    throw new Error("No mnemonic set at process.env.MNEMONIC");
  }

  const managerWallet = ethers.Wallet.fromMnemonic(mnemonic, manager);
  console.log(`Using account ${managerWallet.address} to sign`);

  const signedOrder = await signOrderForSwap({
    vaultAddress,
    counterpartyAddress,
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    signerPrivateKey: managerWallet.privateKey,
  });

  const date = new Date(parseInt(signedOrder.expiry) * 1000);
  const dateStr = date.toISOString().replace(/:/g, "-");
  const fileName = `order-${otokenSymbol}-${dateStr}.json`;
  console.log(fileName);

  const filePath = path.normalize(
    path.join(__dirname, "..", "build", fileName)
  );
  await promisify(fs.writeFile)(filePath, JSON.stringify(signedOrder));

  console.log(`Wrote order file to ${filePath}`);
  console.log("Use pinata.cloud to upload and pin.");

  process.exit(0);
}

signAirswapOrder();
