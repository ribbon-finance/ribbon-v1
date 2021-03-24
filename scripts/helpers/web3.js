require("dotenv").config();
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const getWeb3 = (network) => {
  const uris = {
    mainnet: process.env.MAINNET_URI,
    "mainnet-sim": "http://127.0.0.1:8545",
    kovan: process.env.INFURA_KOVAN_URI,
  };

  const mnemonics = {
    mainnet: process.env.MNEMONIC,
    "mainnet-sim": process.env.MNEMONIC,
    kovan: process.env.KOVAN_MNEMONIC,
  };

  const uri = uris[network];

  const provider = new HDWalletProvider(mnemonics[network], uri);
  const web3 = new Web3(new Web3.providers.HttpProvider(uri));
  web3.setProvider(provider);
  return web3;
};

module.exports = getWeb3;
