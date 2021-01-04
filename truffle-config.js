require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.INFURA_RINKEBY_URI
        ),
      network_id: 4,
      gas: 5500000,
      networkCheckTimeout: 1000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    kovan: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.INFURA_KOVAN_URI
        ),
      network_id: 42,
      gas: 5500000,
      networkCheckTimeout: 1000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    mainnet: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.INFURA_MAINNET_URI,
          0,
          10,
          "m/44'/60'/0'/0/"
        ),
      network_id: 1,
      gas: 5500000,
      gasPrice: 300000000000,
      networkCheckTimeout: 20000,
      confirmations: 1,
      timeoutBlocks: 20000,
      skipDryRun: false,
    },
  },

  api_keys: {
    etherscan: "ENT2EY4U26UMK69U4IQ27IY6CKNY5WUETZ",
  },

  plugins: ["truffle-contract-size", "truffle-plugin-verify"],

  mocha: {
    timeout: 100000,
  },

  compilers: {
    solc: {
      version: "0.6.8",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
