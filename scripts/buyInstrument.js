const axios = require("axios").default;
const getWeb3 = require("./helpers/web3");
const { Command } = require("commander");
const instrumentJSON = require("../build/contracts/RibbonVolatility.json");
const instrumentsDeployed = require("../constants/instruments.json");
const accounts = require("../constants/accounts.json");
const getGasPrice = require("./helpers/getGasPrice");
const { BN, ether } = require("@openzeppelin/test-helpers");

let web3;
const program = new Command();

program.version("0.0.1");
program
  .option("-N, --network <network>", "Ethereum network", "mainnet-sim")
  .requiredOption("-i, --instrument <instrument>", "Instrument address");

program.parse(process.argv);

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

async function buyInstrument(
  { venues, optionTypes, amounts, strikePrices, buyData },
  offchainCost,
  gasPrice
) {
  const { network } = program;
  web3 = getWeb3(network);
  const { owner } = accounts[network];

  const instrumentAddresses = instrumentsDeployed[network];
  const instrumentDetails = instrumentAddresses.find(
    (i) => i.address === program.instrument
  );
  if (!instrumentDetails) {
    throw new Error(`No instrument with address ${instrumentAddress} found`);
  }

  const instrument = new web3.eth.Contract(
    instrumentJSON.abi,
    instrumentDetails.address
  );
  const instrumentSymbol = await instrument.methods.symbol().call();
  console.log(`Buying instrument ${instrumentSymbol}`);

  gasPrice = gasPrice || (await getGasPrice());
  console.log(`Using gas price: ${web3.utils.fromWei(gasPrice, "gwei")} gwei`);

  const premium = await instrument.methods
    .cost(venues, optionTypes, amounts, strikePrices)
    .call();

  const totalCost = new BN(premium).add(offchainCost);

  console.log(
    `Cost for 0.01 contracts: ${web3.utils.fromWei(totalCost, "ether")} ETH`
  );

  console.log("Sending transaction...");

  const receipt = await instrument.methods
    .buyInstrument(venues, optionTypes, amounts, strikePrices, buyData)
    .send({
      from: owner,
      gas: 850000,
      gasPrice: gasPrice.toString(),
      value: totalCost,
    });
  const txhash = receipt.transactionHash;
  console.log("Txhash: " + txhash);

  process.exit(0);
}

async function buyHegicInstrument() {
  const venues = ["HEGIC", "HEGIC"];
  const optionTypes = [1, 2];
  const amounts = [ether("0.01"), ether("0.01")];
  const strikePrices = [ether("1100"), ether("1100")];
  const buyData = ["0x", "0x"];

  await buyInstrument(
    { venues, optionTypes, amounts, strikePrices, buyData },
    new BN("0")
  );
}

async function buyOpynInstrument() {
  const { network } = program;
  web3 = getWeb3(network);

  const otokenAddress = "0x78A36417C9f3814AE1B4367D03bfF6AC6fd631FB";
  const apiResponse = await get0xQuote(otokenAddress, "100000");

  const cost = calculateZeroExOrderCost(apiResponse);
  const gasPrice = new BN(apiResponse.gasPrice);

  const venues = ["HEGIC", "OPYN_GAMMA"];
  const optionTypes = [1, 2];
  const amounts = [ether("0.001"), ether("0.001")];
  const strikePrices = [ether("960"), ether("960")];
  const buyData = ["0x", serializeZeroExOrder(apiResponse)];

  await buyInstrument(
    { venues, optionTypes, amounts, strikePrices, buyData },
    cost,
    gasPrice
  );
}

const ZERO_EX_API_URI = "https://api.0x.org/swap/v1/quote";

async function get0xQuote(otokenAddress, buyAmount) {
  const data = {
    buyToken: otokenAddress,
    sellToken: "USDC",
    buyAmount: buyAmount,
  };
  const query = new URLSearchParams(data).toString();
  const url = `${ZERO_EX_API_URI}?${query}`;
  const response = await axios.get(url);
  return response.data;
}

function serializeZeroExOrder(apiResponse) {
  return web3.eth.abi.encodeParameters(
    [
      {
        ZeroExOrder: {
          exchangeAddress: "address",
          buyTokenAddress: "address",
          sellTokenAddress: "address",
          allowanceTarget: "address",
          protocolFee: "uint256",
          makerAssetAmount: "uint256",
          takerAssetAmount: "uint256",
          swapData: "bytes",
        },
      },
    ],
    [
      {
        exchangeAddress: apiResponse.to,
        buyTokenAddress: apiResponse.buyTokenAddress,
        sellTokenAddress: apiResponse.sellTokenAddress,
        allowanceTarget: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        protocolFee: apiResponse.protocolFee,
        makerAssetAmount: apiResponse.buyAmount,
        takerAssetAmount: apiResponse.sellAmount,
        swapData: apiResponse.data,
      },
    ]
  );
}

function calculateZeroExOrderCost(apiResponse) {
  let decimals;

  if (apiResponse.sellTokenAddress === USDC_ADDRESS.toLowerCase()) {
    decimals = 10 ** 6;
  } else if (apiResponse.sellTokenAddress === WETH_ADDRESS.toLowerCase()) {
    return new BN(apiResponse.sellAmount);
  } else {
    decimals = 10 ** 18;
  }

  const scaledSellAmount = parseInt(apiResponse.sellAmount) / decimals;
  const totalETH =
    scaledSellAmount / parseFloat(apiResponse.sellTokenToEthRate);

  return ether(totalETH.toPrecision(6)).add(new BN(apiResponse.value));
}

buyOpynInstrument();
