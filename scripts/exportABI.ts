import hre from "hardhat";
import fs from "fs";
import path from "path";

const constantFiles = [
  "accounts.json",
  "deployments.json",
  "externalAddresses.json",
];
const contractNames = ["IERC20", "RibbonCoveredCall"];
const destinations = [process.env.RIBBON_WEBAPP_CONSTANTS];

async function main() {
  await copyABIs();
  await copyFiles();
}

async function copyFiles() {
  for (let i = 0; i < destinations.length; i++) {
    const dst = destinations[i];
    if (dst) {
      for (let j = 0; j < constantFiles.length; j++) {
        const filename = constantFiles[j];
        const srcPath = path.normalize(
          path.join(__dirname, "..", "constants", filename)
        );
        const dstFilePath = path.join(dst, filename);
        fs.copyFileSync(srcPath, dstFilePath);
        console.log(`Copied ${srcPath} to ${dstFilePath}`);
      }
    }
  }
}

async function copyABIs() {
  const promises = contractNames.map((name) =>
    hre.artifacts.readArtifact(name)
  );
  const responses = await Promise.all(promises);
  const abis = responses.map((r) => r.abi);

  for (let i = 0; i < destinations.length; i++) {
    const dst = destinations[i];

    if (dst) {
      for (let j = 0; j < abis.length; j++) {
        const abi = abis[j];
        const contractName = contractNames[j];
        const dstFilename = path.join(dst, "abis", `${contractName}.json`);
        fs.writeFileSync(dstFilename, JSON.stringify(abi));
        console.log(`Created ${contractName} in ${dstFilename}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
