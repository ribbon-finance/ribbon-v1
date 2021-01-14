const { BN } = require("@openzeppelin/test-helpers");
const axios = require("axios").default;

const gasStationURL = "https://ethgasstation.info/api/ethgasAPI.json?";

module.exports = async function () {
  const response = await axios.get(gasStationURL);
  const fastPrice = new BN(response.data.fast.toString());
  return fastPrice.mul(new BN("10").pow(new BN("8")));
};
