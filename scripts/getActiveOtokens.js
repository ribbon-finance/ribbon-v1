const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const axios = require("axios").default;

const GRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/opynfinance/gamma-mainnet";

const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

async function getActiveOtokens() {
  const currentTimestamp = Math.floor(Date.now() / 1000);

  const response = await axios.post(
    GRAPH_URL,
    {
      query: `{
        otokens(where: {
          underlyingAsset: "${WETH_ADDRESS}",
          collateralAsset: "${WETH_ADDRESS}"
          expiryTimestamp_gt: ${currentTimestamp}
        }) {
          id,
          strikePrice
        }
      }`,
      variables: null,
    },
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  const rawOtokens = response.data.data.otokens;

  const otokens = rawOtokens.map((otoken) => ({
    address: otoken.id,
    strikePrice: otoken.strikePrice,
  }));

  await updateOtokens("mainnet", otokens);
}

async function updateOtokens(network, otokens) {
  const filepath = path.normalize(
    path.join(__dirname, "..", "constants", "externalAddresses.json")
  );
  const content = await promisify(fs.readFile)(filepath);
  const externalAddresses = JSON.parse(content.toString());

  externalAddresses[network].otokens = otokens;

  await promisify(fs.writeFile)(
    filepath,
    JSON.stringify(externalAddresses, null, "\t") + "\n"
  );
}

getActiveOtokens();
