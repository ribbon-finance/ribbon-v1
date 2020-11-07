const { promisify } = require("util");
const program = require("commander");
const fs = require("fs");
const path = require("path");

const defaultDstPath = path.join("..", "dojima-frontend", "mvp", "src");

program.requiredOption(
  "-o, --output <directory>",
  "output directory",
  defaultDstPath
);
program.parse(process.argv);

async function copyToPath(srcPaths, dstPath) {
  const artefactPaths = srcPaths.map((p) =>
    path.normalize(path.join(__dirname, p))
  );

  const promises = artefactPaths.map((src) => {
    const filename = path.basename(src);
    const newFileName = path.join(dstPath, filename);
    console.log(`Copying ${filename} to ${newFileName}`);
    return promisify(fs.copyFile)(src, newFileName);
  });
  await Promise.all(promises);
  console.log("Done!");
}

(async function () {
  const dstPath = path.normalize(path.join(__dirname, "..", program.output));

  const addressesPath = [
    "../constants/deployments.json",
    "../constants/externalAddresses.json",
    "../constants/instruments.json",
  ];
  await copyToPath(addressesPath, path.join(dstPath, "constants"));

  const artefactsPath = [
    "../build/contracts/TwinYield.json",
    "../build/contracts/DataProvider.json",
    "../constants/abis/BPool.json",
  ];
  await copyToPath(artefactsPath, path.join(dstPath, "constants", "abis"));
})();
