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
    await deployer.deploy(UniswapAdapter, '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', '0x9d80a1aa0b68c7622818085314c3132ac51d5867', '0xd0a1e359811322d97991e03f863a0c30c2cf029c', '0x939295a7fe6eaa9456425535333f5937630ff963', '0xfd9907223857f25838da5ff65510fd81661fb261');
}