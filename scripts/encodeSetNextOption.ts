import { BigNumber, ethers } from "ethers";
import { Command } from "commander";
import { getDefaultProvider } from "./helpers/getDefaultEthersProvider";
import hre from "hardhat";

const deployments = require("../constants/deployments");

const program = new Command();
program.version("0.0.1");
program
  .requiredOption("-a, --address <oTokenAddress>", "oToken address")
  .requiredOption("-n, --network <network>", "Network", "kovan");

program.parse(process.argv);

async function encodeSwapData(orderJSON: any) {}

async function main() {
  const network = program.network;
  const provider = getDefaultProvider();

  const otokenArtifact = await hre.artifacts.readArtifact("OtokenInterface");
  const adapterArtifact = await hre.artifacts.readArtifact("GammaAdapter");
  const vaultArtifact = await hre.artifacts.readArtifact("RibbonCoveredCall");

  const otoken = new ethers.Contract(
    program.address,
    otokenArtifact.abi,
    provider
  );

  const underlying = await otoken.underlyingAsset();
  const strikeAsset = await otoken.strikeAsset();
  const collateral = await otoken.collateralAsset();
  const expiry = await otoken.expiryTimestamp();
  const strikePrice = (await otoken.strikePrice())
    .mul(BigNumber.from("10").pow(BigNumber.from("10")))
    .toString();
  const optionType = (await otoken.isPut()) ? 1 : 2;
  const paymentToken = underlying;

  const optionTerms = [
    underlying,
    strikeAsset,
    collateral,
    expiry.toString(),
    strikePrice,
    optionType,
    paymentToken,
  ];
  console.log(optionTerms);

  const adapter = new ethers.Contract(
    deployments[network].GammaAdapterLogic,
    adapterArtifact.abi,
    provider
  );

  const otokenAddress = await adapter.getOptionsAddress(optionTerms);
  if (otokenAddress.toLowerCase() !== program.address.toLowerCase()) {
    throw new Error(`Found otoken ${otokenAddress} does not match`);
  }

  console.log(`Matched with oToken ${otokenAddress}`);

  let iface = new ethers.utils.Interface(vaultArtifact.abi);

  const encoded = iface.encodeFunctionData("setNextOption", [optionTerms]);

  console.log(`Encoded hex data: ${encoded}`);
}

main();
