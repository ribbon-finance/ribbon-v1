require("dotenv").config();
const { BN } = require("@openzeppelin/test-helpers");
const axios = require("axios").default;

const API_URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`;

module.exports = async function () {
  const response = await axios.get(API_URL);
  if (response.data.status !== "1") {
    throw new Error("Etherscan error");
  }
  const fastPrice = new BN(response.data.result.FastGasPrice.toString());
  return fastPrice.mul(new BN("10").pow(new BN("9")));
};
