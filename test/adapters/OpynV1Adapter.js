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
const OpynV1Adapter = contract.fromArtifact("OpynV1Adapter");
const MockDojiFactory = contract.fromArtifact("MockDojiFactory");
const helper = require("../helper.js");
const { deployDefaultUniswap } = require("../utils.js");

const [admin, owner, user] = accounts;
const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

describe("OpynV1Adapter", () => {
  let initSnapshotId, snapshotId;

  before(async function () {
    // we assume the user account is the calling instrument
    this.factory = await MockDojiFactory.new({ from: owner });
    await this.factory.setInstrument(user, { from: user });

    this.adapter = await OpynV1Adapter.new({ from: owner });
    await this.adapter.initialize(owner, this.factory.address);

    this.underlying = ETH_ADDRESS;
    this.strikeAsset = constants.ZERO_ADDRESS;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    this.expiry = Math.floor(expiryDate.getTime() / 1000);
    this.startTime = Math.floor(Date.now() / 1000) + 60; // +60 seconds so we don't get flaky tests
    this.strikePrice = ether("500");

    // test cases
    this.protocolName = "OPYN_V1";
    this.nonFungible = false;

    // premium
    this.callPremium = ether("0.028675");
    this.putPremium = ether("0.028675");

    const snapShot = await helper.takeSnapshot();
    initSnapshotId = snapShot["result"];

    const { oToken, uniswapExchange } = await deployDefaultUniswap();
    this.oToken = oToken;
    this.uniswapExchange = uniswapExchange;
    await this.uniswapExchange.setSwapRate(ether("0.7"));

    await this.adapter.setOTokenWithTerms(
      this.underlying,
      this.strikeAsset,
      this.expiry,
      this.strikePrice,
      CALL_OPTION_TYPE,
      this.oToken.address,
      { from: owner }
    );
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
  });

  describe("#lookupOToken", () => {
    it("looks up the oToken with option terms", async function () {
      assert.equal(
        await this.adapter.lookupOToken(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          CALL_OPTION_TYPE
        ),
        this.oToken.address
      );
    });
  });

  describe("#premium", () => {
    it("gets the premium for a call option", async function () {
      assert.equal(
        (
          await this.adapter.premium(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            CALL_OPTION_TYPE,
            ether("1")
          )
        ).toString(),
        ether("0.7")
      );
    });
  });
});
