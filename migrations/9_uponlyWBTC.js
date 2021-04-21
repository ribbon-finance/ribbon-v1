const BN = web3.utils.BN;
const { ethers } = require("hardhat");
const { BigNumber, constants } = require("ethers");
const { provider, getContractAt } = ethers;
const WBTC = artifacts.require("FakeWBTC");
const DIGG = artifacts.require("FakeDIGG");
const HEGIC = artifacts.require("FakeHEGIC");
const PriceProvider = artifacts.require("FakePriceProvider");
const BTCPriceProvider = artifacts.require("FakeBTCPriceProvider");
const StakingWBTC = artifacts.require("HegicStakingWBTC");
const WBTCOptions = artifacts.require("HegicWBTCOptions");
const WBTCStakingRewards = artifacts.require("WBTCStakingRewards");
const WBTCRewards = artifacts.require("HegicWBTCRewards");
const AmmAdapterLib = artifacts.require("AmmAdapter");
const ProtocolAdapterLib = artifacts.require("ProtocolAdapter");
const StakedPut = artifacts.require("StakedPut");

let network;

const params = {
  ETHtoBTC() {
    return this.ETHPrice.mul(new BN("10000000000000000000000000000000")).div(
      this.BTCPrice
    );
  },
  BTCPrice: new BN("1161000000000"),
  ETHPrice: new BN(380e8),
};
module.exports = async function (deployer, _network) {
  network = _network;
  console.log(network);
  await deployer.deploy(BTCPriceProvider, params.BTCPrice);

  await deployer.deploy(StakingWBTC, HEGIC.address, WBTC.address);

  await deployer.deploy(
    WBTCOptions,
    EXTERNAL_ADDRESSES[networkLookup].feeds.btc/usd,
    //sushiswap kovan
    "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    EXTERNAL_ADDRESSES[networkLookup].assets.wbtc2,
    EXTERNAL_ADDRESSES[networkLookup].hegicStakingWBTC
  );

  await ProtocolAdapterLib.deployed();

  await deployer.link(ProtocolAdapterLib, StakedPut);
  await AmmAdapterLib.deployed();

  await deployer.link(AmmAdapterLib, StakedPut);
  await deployer.deploy(
    StakedPut,
    DEPLOYMENTS[networkLookup].RibbonFactory,
    DEPLOYMENTS[networkLookup].UniswapAdapter,
    EXTERNAL_ADDRESSES[networkLookup].assets.wbtc2,
    EXTERNAL_ADDRESSES[networkLookup].hegicWBTCOptions,
    EXTERNAL_ADDRESSES[networkLookup].assets.usdc,
    EXTERNAL_ADDRESSES[networkLookup].feeds.btc/usd,
    { from: "" }
  );
};

