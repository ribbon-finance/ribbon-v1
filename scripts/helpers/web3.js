require("dotenv").config();
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const getWeb3 = (network) => {
  const uri =
    network === "mainnet-sim"
      ? "http://127.0.0.1:8545"
      : process.env.MAINNET_URI;

  const provider = new HDWalletProvider(process.env.MNEMONIC, uri);
  const web3 = new Web3(new Web3.providers.HttpProvider(uri));
  web3.setProvider(provider);
  return web3;
};

module.exports = getWeb3;
