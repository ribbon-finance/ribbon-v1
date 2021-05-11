import { Command } from "commander";
import { BigNumber, ethers } from "ethers";
import {
  getDefaultProvider,
  Networks,
} from "./helpers/getDefaultEthersProvider";
import colors from "colors";
import hre from "hardhat";
import moment from "moment";
import deployments from "../constants/deployments.json";

const program = new Command();
program.version("0.0.1");
program.requiredOption("-n, --network <network>", "Network", "mainnet");

program.parse(process.argv);

async function main() {
  const network = program.network === "mainnet" ? "mainnet" : "kovan";

  await verifyVaultOtoken(deployments[network].RibbonETHCoveredCall, network);
  await verifyVaultOtoken(deployments[network].RibbonWBTCCoveredCall, network);
  await verifyVaultOtoken(deployments[network].RibbonETHPut, network);
}

async function verifyVaultOtoken(vaultAddress: string, network: Networks) {
  const provider = getDefaultProvider(network);
  const vaultArtifact = await hre.artifacts.readArtifact("RibbonThetaVault");
  const otokenArtifact = await hre.artifacts.readArtifact("OtokenInterface");
  const erc20Artifact = await hre.artifacts.readArtifact("IERC20Detailed");

  const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, provider);

  const nextOption = await vault.currentOption();
  const currentOption = await vault.nextOption();
  const hasRolled = nextOption === ethers.constants.AddressZero;
  const otokenAddress = hasRolled ? currentOption : nextOption;

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

  const expectedAsset = await vault.asset();
  const actualAsset = await otoken.collateralAsset();
  const assetMatch =
    actualAsset === expectedAsset
      ? colors.green("Match")
      : colors.red("Mismatch");

  const expectedUnderlying = await vault.underlying();
  const symbol = await otokenERC20.symbol();
  const actualUnderlying = await otoken.underlyingAsset();
  const timestamp = await otoken.expiryTimestamp();
  const strikePrice = (await otoken.strikePrice()).div(
    BigNumber.from("10").pow(BigNumber.from("8"))
  );

  const underlyingMatch =
    actualUnderlying === expectedUnderlying
      ? colors.green("Match")
      : colors.red("Mismatch");

  const dt = moment.unix(timestamp);
  const isFriday = dt.day() === 5;
  const lessThanAWeek = dt.diff(moment(), "days") < 7;
  const validTimestamp =
    isFriday && lessThanAWeek ? colors.green("Valid") : colors.red("Invalid");

  console.log(`Vault: ${vaultAddress}`);
  console.log(
    `${
      hasRolled ? colors.yellow("currentOption") : colors.yellow("nextOption")
    }: https://etherscan.io/address/${otokenAddress}`
  );
  console.log(`${"Symbol:".padEnd(20)} ${symbol}`);
  console.log(`${"Strike Price:".padEnd(20)} $${strikePrice.toLocaleString()}`);
  console.log(`${"Collateral asset:".padEnd(20)} ${assetMatch} ${actualAsset}`);
  console.log(
    `${"Underlying asset:".padEnd(20)} ${underlyingMatch} ${actualUnderlying}`
  );
  console.log(
    `${"Expiry:".padEnd(20)} ${validTimestamp} ${dt.utc().toISOString()}`
  );
  console.log();
}

main();
