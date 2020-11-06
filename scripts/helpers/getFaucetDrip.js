/**
 * Read this doc for more details https://docs.balancer.finance/guides/testing-on-kovan
 */
const web3 = require("./web3");
const accounts = require("../../constants/accounts.json");
const FAUCET_ADDRESS = "0xb48Cc42C45d262534e46d5965a9Ac496F1B7a830";

const FAUCET_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
    ],
    name: "drip",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

module.exports = { getFaucetDrip };

async function getFaucetDrip(tokenAddress, fromAccount = accounts.owner) {
  try {
    const faucet = new web3.eth.Contract(FAUCET_ABI, FAUCET_ADDRESS);
    const receipt = await faucet.methods
      .drip(tokenAddress)
      .send({ from: fromAccount });
    return receipt;
  } catch (e) {
    console.error(e);
  }
}
