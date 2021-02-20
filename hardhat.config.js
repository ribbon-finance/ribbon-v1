/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");

require("dotenv").config();

module.exports = {
  solidity: "0.7.2",
  networks: {
    hardhat: {
      forking: {
        url: process.env.TEST_URI,
        gasLimit: 8e6,
        blockNumber: 11611333,
      },
    },
  },
  mocha: {
    timeout: 200000,
  },
};
