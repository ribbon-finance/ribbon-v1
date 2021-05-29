const EXTERNAL_ADDRESSES = require("../constants/externalAddresses.json");
const UniswapAdapter = artifacts.require("UniswapAdapter");

let network;
module.exports = async function (deployer, _network) {
    const networkLookup = _network;

    await deployer.deploy(UniswapAdapter, EXTERNAL_ADDRESSES[networkLookup].sushiswap, EXTERNAL_ADDRESSES[networkLookup].assets.wbtc, EXTERNAL_ADDRESSES[networkLookup].assets.weth, EXTERNAL_ADDRESSES[networkLookup].assets.sushiLp, EXTERNAL_ADDRESSES[networkLookup].assets.digg);
};
