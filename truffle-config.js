require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(process.env.PRIV_KEY, process.env.INFURA_URI),
      network_id: 3,
      gas: 5500000,
      networkCheckTimeout: 1000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  mocha: {
    timeout: 100000,
  },

  compilers: {
    solc: {
      version: "0.6.2",
    },
  },
};
