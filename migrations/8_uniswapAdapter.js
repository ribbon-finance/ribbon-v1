const BN = web3.utils.BN
const { ethers } = require("hardhat");
const { BigNumber, constants } = require("ethers");
const { provider, getContractAt } = ethers;
const WBTC = artifacts.require("FakeWBTC")
const DIGG = artifacts.require("FakeDIGG")
const UniswapAdapter = artifacts.require("UniswapAdapter")

let network;
module.exports = async function (deployer, _network) {
    network = _network;
    console.log(network);

    const w = await deployer.deploy(WBTC);

    const d = await deployer.deploy(DIGG);

    //used already deployed uniswap contract on kovan
    //minted wbtc and digg + added liquidity to uniswap
    //used already deployed weth on kovan
    await deployer.deploy(UniswapAdapter, '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', EXTERNAL_ADDRESSES[networkLookup].assets.wbtc2, EXTERNAL_ADDRESSES[networkLookup].assets.weth, EXTERNAL_ADDRESSES[networkLookup].assets.uniLp, EXTERNAL_ADDRESSES[networkLookup].assets.digg);
}