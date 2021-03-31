import { ethers } from "ethers";

type Networks = "mainnet" | "kovan";

export const getDefaultProvider = (network: Networks = "kovan") => {
  const url =
    network === "mainnet"
      ? process.env.MAINNET_URI
      : process.env.INFURA_KOVAN_URI;

  const provider = new ethers.providers.JsonRpcProvider(url);

  return provider;
};
