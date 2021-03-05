import { createOrder, signTypedDataOrder } from "@airswap/utils";

const SWAP_CONTRACT = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";

export async function signOrderForSwap({
  vaultAddress,
  counterpartyAddress,
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  signerPrivateKey,
}: {
  vaultAddress: string;
  counterpartyAddress: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  signerPrivateKey: string;
}) {
  let order = createOrder({
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

  const signedOrder = await signTypedDataOrder(
    order,
    signerPrivateKey,
    SWAP_CONTRACT
  );
  return signedOrder;
}
