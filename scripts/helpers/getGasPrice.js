require("dotenv").config();
const { BN } = require("@openzeppelin/test-helpers");
const axios = require("axios").default;

const API_URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`;

module.exports = async function (isFast = true) {
  const response = await axios.get(API_URL);
  if (response.data.status !== "1") {
    throw new Error("Etherscan error");
  }
  const price = isFast ? new BN(response.data.result.FastGasPrice.toString()) : new BN(response.data.result.ProposeGasPrice.toString());
  return price.mul(new BN("10").pow(new BN("9")));
};
