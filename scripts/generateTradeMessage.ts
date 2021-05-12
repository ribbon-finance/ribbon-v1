import { Command } from "commander";
import { BigNumber, ethers } from "ethers";
import {
  getDefaultProvider,
  Networks,
} from "./helpers/getDefaultEthersProvider";
import hre from "hardhat";
import moment from "moment";
import deployments from "../constants/deployments.json";

const program = new Command();
program.version("0.0.1");
program.requiredOption("-n, --network <network>", "Network", "mainnet");

program.parse(process.argv);

async function main() {
  const network = program.network === "mainnet" ? "mainnet" : "kovan";

  await verifyRollToNextOption(
    "ETH",
    deployments[network].RibbonETHCoveredCall,
    network
  );
  await verifyRollToNextOption(
    "WBTC",
    deployments[network].RibbonWBTCCoveredCall,
    network
  );
  await verifyRollToNextOption(
    "ETH",
    deployments[network].RibbonETHPut,
    network
  );
}

async function verifyRollToNextOption(
  assetName: string,
  vaultAddress: string,
  network: Networks
) {
  const provider = getDefaultProvider(network);
  const vaultArtifact = await hre.artifacts.readArtifact("RibbonThetaVault");
  const otokenArtifact = await hre.artifacts.readArtifact("OtokenInterface");
  const erc20Artifact = await hre.artifacts.readArtifact("IERC20Detailed");

  const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, provider);

  const otokenAddress = await vault.currentOption();

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

  const optionType = (await otoken.isPut()) ? "Put" : "Call";
  const timestamp = await otoken.expiryTimestamp();
  const strikePrice = (await otoken.strikePrice()).div(
    BigNumber.from("10").pow(BigNumber.from("8"))
  );
  const dt = moment.unix(timestamp);
  const otokenBalance = (await otokenERC20.balanceOf(vaultAddress)).div(
    BigNumber.from("10").pow(BigNumber.from("8"))
  );

  const message = `oToken ${assetName}/USDC ${optionType}
oToken Address: ${otokenAddress}
Counterparty Address: ${vaultAddress}
Strike: ${strikePrice}
Expiry: ${dt.utc().format("DDMMMYY").toUpperCase()}
Quantity (contracts): ${otokenBalance}\n`;

  console.log(message);
}

main();
