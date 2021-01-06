const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
  BN,
  ether,
  constants,
  time,
  expectRevert,
  expectEvent,
  balance,
} = require("@openzeppelin/test-helpers");
const { assert } = require("chai");
const helper = require("../helper.js");
const MockGammaAdapter = contract.fromArtifact("MockGammaAdapter");
const IERC20 = contract.fromArtifact("IERC20");

const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const [admin, owner, user, recipient] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("GammaAdapter", () => {
  let initSnapshotId;
  const gasPrice = web3.utils.toWei("10", "gwei");

  before(async function () {
    this.protocolName = "OPYN_GAMMA";
    this.nonFungible = false;

    this.adapter = await MockGammaAdapter.new(OTOKEN_FACTORY, WETH_ADDRESS, {
      from: owner,
    });

    const snapShot = await helper.takeSnapshot();
    initSnapshotId = snapShot["result"];
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
  });

  describe("#protocolName", () => {
    it("matches the protocol name", async function () {
      assert.equal(await this.adapter.protocolName(), this.protocolName);
    });
  });

  describe("#nonFungible", () => {
    it("matches the nonFungible bool", async function () {
      assert.equal(await this.adapter.nonFungible(), this.nonFungible);
    });
  });

  describe("#lookupOtoken", () => {
    it("looks oToken correctly", async function () {
      const oTokenAddress = "0x60ad22806B89DD17B2ecfe220c3712A2c86dfFFE";

      const actualOTokenAddress = await this.adapter.lookupOToken(
        constants.ZERO_ADDRESS,
        USDC_ADDRESS,
        WETH_ADDRESS,
        "1614326400",
        ether("800"),
        CALL_OPTION_TYPE
      );
      assert.equal(actualOTokenAddress, oTokenAddress);
    });
  });
});

function behavesLikeOTokens(params) {
  describe(`${params.name}`, () => {
    before(async function () {});
  });
}
