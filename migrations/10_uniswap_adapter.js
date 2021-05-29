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

    await deployer.deploy(UniswapAdapter, EXTERNAL_ADDRESSES[networkLookup].sushiswap, EXTERNAL_ADDRESSES[networkLookup].assets.wbtc, EXTERNAL_ADDRESSES[networkLookup].assets.weth, EXTERNAL_ADDRESSES[networkLookup].assets.sushiLp, EXTERNAL_ADDRESSES[networkLookup].assets.digg);
}