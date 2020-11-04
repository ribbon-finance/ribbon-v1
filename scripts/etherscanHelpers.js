const { promisify } = require("util");
const request = require("request");

module.exports = { verifyEtherscan };

const API_URL = "http://api-kovan.etherscan.io/api";

async function waitUntil(condition, task) {
  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      task().then((res) => {
        if (condition(res)) {
          resolve();
          clearInterval(interval);
        }
      });
    }, 1000);
  });
}

async function verifyEtherscan(address, contractName, constructorArgs) {
  const source = getSoliditySource(contractName);

  const guid = await sendVerificationRequest(address, source, constructorArgs);

  console.log("Polling verification status for 30 seconds...");

  await waitUntil(
    (res) => res.result !== "Pending in queue",
    async () => {
      const res = await checkVerificationStatus(guid);
      console.log(res);
      return res;
    }
  );

  // const status = await checkVerificationStatus(guid);
  // console.log(status);
}

async function checkVerificationStatus(guid) {
  const data = {
    apikey: process.env.ETHERSCAN_API_KEY,
    guid: guid,
    module: "contract",
    action: "checkverifystatus",
  };

  const res = await promisify(request.post)({
    url: API_URL,
    form: data,
  });

  return JSON.parse(res.body);
}

async function sendVerificationRequest(address, source, constructorArgs) {
  console.log("Verifying on Etherscan");

  var data = {
    apikey: process.env.ETHERSCAN_API_KEY,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: source,
    codeformat: "solidity-single-file",
    contractname: "DojimaInstrument",
    compilerversion: "v0.6.8+commit.0bbfe453",
    optimizationUsed: 1,
    runs: 200,
    constructorArguments: constructorArgs,
  };

  const res = await promisify(request.post)({
    url: "http://api-kovan.etherscan.io/api",
    form: data,
  });

  const body = JSON.parse(res.body);
  if (body.status !== "1") {
    throw new Error("Failed to verify");
  }

  const guid = body.result;
  console.log("Sent verification request " + guid);

  return guid;
}

async function getSoliditySource(filename) {
  console.log("Reading solidity source");
  const filepath = path.normalize(
    path.join(__dirname, "..", "build", "compiled", filename)
  );

  const exists = await promisify(fs.exists)(filepath);
  if (!exists) {
    console.log("File doesnt exist");
  }
  const source = await promisify(fs.readFile)(filepath).toString();
  console.log("Done reading");
  return source;
}
