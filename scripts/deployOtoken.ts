import { BigNumber, ethers } from "ethers";
import {
  getDefaultProvider,
  getDefaultSigner,
} from "./helpers/getDefaultEthersProvider";
import { Command } from "commander";
import { encodeCommitAndClose } from "./helpers/encodeCommitAndClose";
import { getGasPrice } from "./helpers/getGasPrice";
import hre from "hardhat";
import externalAddresses from "../constants/externalAddresses.json";
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
  const otokenArtifact = await hre.artifacts.readArtifact("OtokenInterface");
  const erc20Artifact = await hre.artifacts.readArtifact("IERC20Detailed");

  const network = program.network === "mainnet" ? "mainnet" : "kovan";

  const provider = getDefaultProvider(program.network);
  const signer = getDefaultSigner("m/44'/60'/0'/0/1", network).connect(
    provider
  );

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
    oTokenFactoryABI,
    provider
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

  const tx = await factory
    .connect(signer)
    .createOtoken(
      underlying,
      strikeAsset,
      collateralAsset,
      strikePrice,
      expiry,
      isPut,
      {
        gasPrice,
      }
    );
  console.log("Txhash: " + tx.hash);
  const receipt = await tx.wait(1);

  const otokenAddress = ethers.utils.getAddress(
    "0x" + receipt.logs[0].topics[1].slice(26)
  );
  console.log(`\nOtoken: ${otokenAddress}`);

  const otoken = new ethers.Contract(
    otokenAddress,
    otokenArtifact.abi,
    provider
  );
  const otokenERC20 = new ethers.Contract(
    otokenAddress,
    erc20Artifact.abi,
    provider
  );

  const scaleBy = BigNumber.from("10").pow(BigNumber.from("8"));

  console.log(`Symbol: ${await otokenERC20.symbol()}`);
  console.log(`Strike price: ${(await otoken.strikePrice()).div(scaleBy)}`);
  console.log(`Underlying: ${await otoken.underlyingAsset()}`);
  console.log(`Strike: ${await otoken.strikeAsset()}`);
  console.log(`Collateral: ${await otoken.collateralAsset()}`);
  console.log(
    `Expiry: ${new Date((await otoken.expiryTimestamp()) * 1000).toUTCString()}`
  );
  console.log(`Option type: ${(await otoken.isPut()) ? "PUT" : "CALL"}`);

  await encodeCommitAndClose(network, otokenAddress);

  process.exit(0);
}

deployOToken();
