const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

module.exports = {
  updateDeployedAddresses,
};

async function updateDeployedAddresses(network, contractName, address) {
  const filepath = path.normalize(
    path.join(__dirname, "..", "..", "constants", "deployments.json")
  );

  const content = await promisify(fs.readFile)(filepath);
  const deployments = JSON.parse(content.toString());

  deployments[network][contractName] = address;

  await promisify(fs.writeFile)(
    filepath,
    JSON.stringify(deployments, null, "\t") + "\n"
  );
}
