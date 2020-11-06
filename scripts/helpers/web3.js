require("dotenv").config();
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const provider = new HDWalletProvider(
  process.env.MNEMONIC,
  process.env.INFURA_KOVAN_URI
);
const web3 = new Web3(
  new Web3.providers.HttpProvider(process.env.INFURA_KOVAN_URI)
);
web3.setProvider(provider);

module.exports = web3;
