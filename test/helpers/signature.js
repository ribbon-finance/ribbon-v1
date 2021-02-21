const { createOrder, signOrder } = require("@airswap/utils");

module.exports = {
  signOrderForSwap,
};

const SWAP_CONTRACT = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";

async function signOrderForSwap({
  vaultAddress,
  counterpartyAddress,
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  signer,
}) {
  const order = createOrder({
    signer: {
      wallet: vaultAddress,
      token: sellToken,
      amount: sellAmount,
    },
    sender: {
      wallet: counterpartyAddress,
      token: buyToken,
      amount: buyAmount,
    },
  });
  const signedOrder = await signOrder(order, signer, SWAP_CONTRACT);
  return signedOrder;
}
