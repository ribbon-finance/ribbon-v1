import { ethers } from "ethers";

export const getProvider = () => {
  if (!process.env["MAINNET_URI"]) {
    throw new Error("MAINNET_URI not set");
  }
  return new ethers.providers.JsonRpcProvider(process.env["MAINNET_URI"], 1);
};
