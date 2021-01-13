require("dotenv").config();

module.exports = {
  node: {
    fork: process.env.TEST_URI,
    gasLimit: 8e6, // Maximum gas per block
  },
};
