require("dotenv").config();
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { ether } = require("@openzeppelin/test-helpers");
const accounts = require("../constants/accounts.json");
const OpynV1Adapter = require("../build/contracts/OpynV1Adapter.json");
const MockFactory = require("../build/contracts/MockDojiFactory.json");

let web3;
const admin = accounts.kovan.admin;
const owner = accounts.kovan.owner;
const aaveAddressProvider = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

async function deployOpynV1Adapter(dojiFactoryAddress) {
  const opynV1Contract = new web3.eth.Contract(OpynV1Adapter.abi);
  const opynV1Instance = await opynV1Contract
    .deploy({
      data: OpynV1Adapter.bytecode,
      arguments: [aaveAddressProvider],
    })
    .send({ from: owner });

  console.log("OpynV1Adapter deployed at " + opynV1Instance.options.address);

  await opynV1Instance.methods
    .initialize(
      owner,
      dojiFactoryAddress,
      aaveAddressProvider,
      uniswapRouter,
      weth
    )
    .send({ from: owner });

  await setOToken(opynV1Instance);
}

async function setOToken(opynV1Adapter) {
  const oTokenAddress = "0x7EB6Dd0Cc2DF2EAe901f76A151cA82BB7be10d68";
  const CALL_TYPE = 2;
  const strikePrice = ether("640");

  await opynV1Adapter.methods
    .setOTokenWithTerms(strikePrice, CALL_TYPE, oTokenAddress)
    .send({ from: owner });
}

async function deployDojiFactory() {
  const factoryContract = new web3.eth.Contract(MockFactory.abi);
  const factoryInstance = await factoryContract
    .deploy({ data: MockFactory.bytecode, arguments: [owner, admin] })
    .send({ from: owner });
  console.log("DojiFactory deployed at " + factoryInstance.options.address);

  await factoryInstance.methods.setInstrument(owner).send({ from: owner });
  console.log("Instrument set");

  return factoryInstance.options.address;
}

async function getMainnetForkWeb3() {
  const provider = new HDWalletProvider(
    process.env.MNEMONIC,
    process.env.INFURA_MAINNET_FORK_URI
  );
  const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.INFURA_MAINNET_FORK_URI)
  );
  web3.setProvider(provider);
  return web3;
}

async function main() {
  web3 = await getMainnetForkWeb3();
  const factoryAddress = await deployDojiFactory();
  await deployOpynV1Adapter(factoryAddress);

  process.exit();
}

main();
