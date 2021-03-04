require("dotenv").config();
const getWeb3 = require("./helpers/web3");
const { signOrderForSwap } = require("./helpers/signature");
const { Command } = require("commander");
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const program = new Command();

const vaultJSON = require("../build/contracts/RibbonETHCoveredCall.json");
const erc20JSON = require("../build/contracts/IERC20.json");

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

  const managerWallet = ethers.Wallet.fromMnemonic(
    process.env.MNEMONIC,
    manager
  );
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

  const date = new Date(signedOrder.expiry * 1000);
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
