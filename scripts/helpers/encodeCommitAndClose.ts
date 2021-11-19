import { BigNumber, ethers } from "ethers";
import { Networks, getDefaultProvider } from "./getDefaultEthersProvider";
import hre from "hardhat";

const deployments = require("../../constants/deployments");

export async function encodeCommitAndClose(
  network: Networks,
  otokenAddress: string
) {
  otokenAddress = ethers.utils.getAddress(otokenAddress);
  const provider = getDefaultProvider(network);

  const otokenArtifact = await hre.artifacts.readArtifact("OtokenInterface");
  const adapterArtifact = await hre.artifacts.readArtifact("GammaAdapter");
  const vaultArtifact = await hre.artifacts.readArtifact("RibbonThetaVault");

  const otoken = new ethers.Contract(
    otokenAddress,
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
  console.log();
  console.log("Use this as the parameter for commitAndClose:");
  console.log(JSON.stringify(optionTerms));

  const adapter = new ethers.Contract(
    deployments[network].GammaAdapterLogic,
    adapterArtifact.abi,
    provider
  );

  const foundOtokenAddress = await adapter.getOptionsAddress(optionTerms);
  if (foundOtokenAddress.toLowerCase() !== otokenAddress.toLowerCase()) {
    throw new Error(`Found otoken ${otokenAddress} does not match`);
  }

  console.log("\nEncoded commitAndClose hex data");
  console.log(`Matched with oToken ${otokenAddress}`);

  let iface = new ethers.utils.Interface(vaultArtifact.abi);

  const encoded = iface.encodeFunctionData("commitAndClose", [optionTerms]);

  console.log(`Encoded hex data: ${encoded}`);
}
