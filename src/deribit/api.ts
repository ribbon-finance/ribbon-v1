import axios from "axios";
import { BigNumber } from "ethers";
import { ASSETS } from "../constants";

const tickerMap = {
  [ASSETS.WETH]: "ETH",
  [ASSETS.WBTC]: "BTC",
};

export function getOptionName(
  underlying: string,
  expiry: number,
  strikePrice: string,
  isPut: boolean
) {
  const ticker = tickerMap[underlying];
  if (!ticker) {
    throw new Error(`No found ticker with address ${underlying}`);
  }

  const date = new Date(expiry * 1000);
  const day = date.getUTCDay();
  const year = date.getUTCFullYear().toString().slice(2);
  const month = date.getUTCMonth();
  const optionType = isPut ? "P" : "C";
  const strike = BigNumber.from(strikePrice)
    .div(BigNumber.from("10").pow("8"))
    .toString();

  return `${ticker}-${day}${month}${year}-${strike}-${optionType}`;
}

console.log(getOptionName(ASSETS.WETH, 1614931200, "140000000000", false));
