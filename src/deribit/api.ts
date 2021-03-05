import axios from "axios";
import { BigNumber, ethers } from "ethers";
import { ASSETS } from "../constants";
import OtokenInterface from "../../build/contracts/OtokenInterface.json";
import { getProvider } from "../connection";
import moment from "moment";

require("dotenv").config();
const clientID = process.env["DERIBIT_CLIENT_ID"];
const clientSecret = process.env["DERIBIT_CLIENT_SECRET"];

const tickerMap = {
  [ASSETS.WETH]: "ETH",
  [ASSETS.WBTC]: "BTC",
};

const DERIBIT_URL = "https://test.deribit.com/api/v2";

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

  const dateStr = moment(new Date(expiry * 1000))
    .format("DMMMYY")
    .toUpperCase();
  const optionType = isPut ? "P" : "C";
  const strike = BigNumber.from(strikePrice)
    .div(BigNumber.from("10").pow("8"))
    .toString();

  return `${ticker}-${dateStr}-${strike}-${optionType}`;
}

export async function getOptionNameFromOtoken(otokenAddress: string) {
  const provider = getProvider();
  const otoken = new ethers.Contract(
    otokenAddress,
    OtokenInterface.abi,
    provider
  );
  const underlying = await otoken.underlyingAsset();
  const expiry = await otoken.expiryTimestamp();
  const isPut = await otoken.isPut();
  const strikePrice = await otoken.strikePrice();
  return getOptionName(
    underlying,
    expiry.toNumber(),
    strikePrice.toString(),
    isPut
  );
}

export async function authenticate(): Promise<string> {
  const data = {
    client_id: clientID as string,
    client_secret: clientSecret as string,
    grant_type: "client_credentials",
    scope: "trade:read_write",
  };

  const response = await deribitAPICall("auth", data, "public");
  return response.result.access_token;
}

export async function getPositions(
  accessToken: string,
  currency: string,
  instrumentType = "option"
) {
  const data = {
    currency,
    kind: instrumentType,
  };
  const response = await deribitAPICall(
    "get_positions",
    data,
    "private",
    accessToken
  );
  return response;
}

export async function getInstrument(instrument: string) {
  const data = { instrument_name: instrument };
  const response = await deribitAPICall("get_instrument", data, "public");
  return response;
}

export async function deribitAPICall(
  endpoint: string,
  data: Record<string, string>,
  endpointType = "public",
  accessToken: string | null = null
) {
  if (!clientID || !clientSecret) {
    throw new Error("DERIBIT_CLIENT_ID & DERIBIT_CLIENT_SECRET need to be set");
  }

  const urlParams = new URLSearchParams(data).toString();

  try {
    const res = await axios.get(
      `${DERIBIT_URL}/${endpointType}/${endpoint}?${urlParams}`,
      {
        headers:
          accessToken !== null
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : {},
      }
    );
    return res.data;
  } catch (e) {
    console.error(e.response.data);
    throw e;
  }
}

(async function () {
  const optionName = await getOptionNameFromOtoken(
    "0x8eeED0dD82391e55cA39bd08CAF80Db0Eb29032b"
  );
  console.log(optionName);
  console.log(await getInstrument(optionName));
})();

// console.log(getOptionName(ASSETS.WETH, 1614931200, "140000000000", false));
