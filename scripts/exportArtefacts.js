const { promisify } = require("util");
const program = require("commander");
const fs = require("fs");
const path = require("path");

program.requiredOption("-o, --output <directory>", "output directory");
program.parse(process.argv);

(async function () {
  const dstPath = path.normalize(path.join(__dirname, "..", program.output));

  const artefactPaths = [
    "../constants/deployments.json",
    "../constants/externalAddresses.json",
    "../constants/instruments.json",
    "../build/contracts/TwinYield.json",
  ].map((p) => path.normalize(path.join(__dirname, p)));

  const promises = artefactPaths.map((src) => {
    const filename = path.basename(src);
    const newFileName = path.join(dstPath, filename);
    return promisify(fs.copyFile)(src, newFileName);
  });
  await Promise.all(promises);
})();
