/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");

require("dotenv").config();

require("@openzeppelin/test-helpers/configure")({
  provider: "http://localhost:8545",
});

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
    timeout: 50000,
  },
};
