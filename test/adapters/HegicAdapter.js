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
const { shouldBehaveLikeProtocolAdapter } = require("./ProtocolAdapter");
const helper = require("../helper.js");
const MockERC20 = contract.fromArtifact("MockERC20");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const MockHegicETHOptions = contract.fromArtifact("MockHegicETHOptions");
const MockHegicWBTCOptions = contract.fromArtifact("MockHegicWBTCOptions");
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const [admin, owner, user, pool, settlementFeeRecipient] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("HegicAdapter", () => {
  let snapshotId;
  const gasPrice = web3.utils.toWei("10", "gwei");

  before(async function () {
    const mintAmount = ether("1000");
    const WBTC = await MockERC20.new("Wrapped Bitcoin", "WBTC", mintAmount, {
      from: owner,
    });
    this.ethOptions = await MockHegicETHOptions.new(
      pool,
      settlementFeeRecipient,
      { from: admin }
    );
    this.wbtcOptions = await MockHegicWBTCOptions.new(
      pool,
      settlementFeeRecipient,
      { from: admin }
    );

    this.adapter = await HegicAdapter.new(
      this.ethOptions.address,
      this.wbtcOptions.address,
      ETH_ADDRESS,
      WBTC.address
    );

    this.underlying = ETH_ADDRESS;
    this.strikeAsset = constants.ZERO_ADDRESS;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    this.expiry = Math.floor(expiryDate.getTime() / 1000);
    this.startTime = Math.floor(Date.now() / 1000) + 60; // +60 seconds so we don't get flaky tests
    this.strikePrice = ether("500");

    // test cases
    this.protocolName = "HEGIC";
    this.nonFungible = true;

    // premium
    this.callPremium = ether("0.028675");
    this.putPremium = ether("0.028675");

    await this.ethOptions.setCurrentPrice(ether("500"));
    await this.wbtcOptions.setCurrentPrice(ether("18000"));
    await time.increaseTo(this.startTime);
  });

  shouldBehaveLikeProtocolAdapter();

  describe("#purchase", () => {
    beforeEach(async () => {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("reverts when not enough value is passed", async function () {
      await expectRevert(
        this.adapter.purchase(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          CALL_OPTION_TYPE,
          ether("1"),
          {
            from: user,
            value: ether("0.01"),
          }
        ),
        "Value does not cover cost"
      );
    });

    it("reverts when buying after expiry", async function () {
      await time.increaseTo(this.expiry + 1);

      await expectRevert(
        this.adapter.purchase(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          CALL_OPTION_TYPE,
          ether("1"),
          {
            from: user,
            value: ether("0.01"),
          }
        ),
        "Cannot purchase after expiry"
      );
    });

    it("reverts when passing unknown underlying", async function () {
      await expectRevert(
        this.adapter.purchase(
          constants.ZERO_ADDRESS,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          CALL_OPTION_TYPE,
          ether("1"),
          {
            from: user,
            value: ether("0.028675"),
          }
        ),
        "No matching options contract"
      );
    });

    it("buys call options on hegic", async function () {
      const res = await this.adapter.purchase(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        CALL_OPTION_TYPE,
        ether("1"),
        {
          from: user,
          value: ether("0.028675"),
        }
      );

      expectEvent(res, "Purchased", {
        protocolName: web3.utils.sha3("HEGIC"),
        underlying: ETH_ADDRESS,
        strikeAsset: this.strikeAsset,
        expiry: this.expiry.toString(),
        strikePrice: ether("500"),
        optionType: CALL_OPTION_TYPE.toString(),
        amount: ether("1"),
        premium: ether("0.028675"),
        optionID: "0",
      });

      const {
        holder,
        strike,
        amount,
        lockedAmount,
        premium,
        expiration,
        optionType,
      } = await this.ethOptions.options(0);

      assert.equal(holder, this.adapter.address);
      assert.equal(strike.toString(), ether("500"));
      assert.equal(amount.toString(), ether("1"));
      assert.equal(lockedAmount.toString(), ether("1"));
      assert.equal(premium.toString(), ether("0.018675"));
      assert.equal(expiration, this.expiry);
      assert.equal(optionType, CALL_OPTION_TYPE);
    });

    it("buys put options on hegic", async function () {
      const res = await this.adapter.purchase(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        PUT_OPTION_TYPE,
        ether("1"),
        {
          from: user,
          value: ether("0.028675"),
        }
      );

      expectEvent(res, "Purchased", {
        protocolName: web3.utils.sha3("HEGIC"),
        underlying: ETH_ADDRESS,
        strikeAsset: this.strikeAsset,
        expiry: this.expiry.toString(),
        strikePrice: ether("500"),
        optionType: PUT_OPTION_TYPE.toString(),
        amount: ether("1"),
        premium: ether("0.028675"),
        optionID: "0",
      });

      const {
        holder,
        strike,
        amount,
        lockedAmount,
        premium,
        expiration,
        optionType,
      } = await this.ethOptions.options(0);

      assert.equal(holder, this.adapter.address);
      assert.equal(strike.toString(), ether("500"));
      assert.equal(amount.toString(), ether("1"));
      assert.equal(lockedAmount.toString(), ether("1"));
      assert.equal(premium.toString(), ether("0.018675"));
      assert.equal(expiration, this.expiry);
      assert.equal(optionType, PUT_OPTION_TYPE);
    });
  });

  describe("#exerciseProfit", () => {
    let callOptionID, putOptionID;

    beforeEach(async function () {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];

      const callRes = await this.adapter.purchase(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        CALL_OPTION_TYPE,
        ether("1"),
        {
          from: user,
          value: ether("0.028675"),
        }
      );
      callOptionID = callRes.receipt.logs[0].args.optionID;

      const putRes = await this.adapter.purchase(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        PUT_OPTION_TYPE,
        ether("1"),
        {
          from: user,
          value: ether("0.028675"),
        }
      );
      putOptionID = putRes.receipt.logs[0].args.optionID;
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("reverts when unknown options address passed", async function () {
      await expectRevert(
        this.adapter.exerciseProfit(constants.ZERO_ADDRESS, callOptionID, 0),
        "optionsAddress must match either ETH or WBTC options"
      );
    });

    it("calculates the profit for exercising a call option", async function () {
      // should be zero if price == strike
      assert.equal(
        await this.adapter.exerciseProfit(
          this.ethOptions.address,
          callOptionID,
          0
        ),
        "0"
      );

      // should be zero if price < strike
      await this.ethOptions.setCurrentPrice(ether("490"));
      assert.equal(
        await this.adapter.exerciseProfit(
          this.ethOptions.address,
          callOptionID,
          0
        ),
        "0"
      );

      // should be positive if price > strike
      await this.ethOptions.setCurrentPrice(ether("550"));
      assert.equal(
        (
          await this.adapter.exerciseProfit(
            this.ethOptions.address,
            callOptionID,
            0
          )
        ).toString(),
        ether("0.090909090909090909")
      );
    });

    it("calculates the profit for exercising a put option", async function () {
      // should be zero if price == strike
      assert.equal(
        await this.adapter.exerciseProfit(
          this.ethOptions.address,
          putOptionID,
          0
        ),
        "0"
      );

      // should be zero if price > strike
      await this.ethOptions.setCurrentPrice(ether("550"));
      assert.equal(
        await this.adapter.exerciseProfit(
          this.ethOptions.address,
          putOptionID,
          0
        ),
        "0"
      );

      // should be zero if price < strike
      await this.ethOptions.setCurrentPrice(ether("450"));
      assert.equal(
        (
          await this.adapter.exerciseProfit(
            this.ethOptions.address,
            putOptionID,
            0
          )
        ).toString(),
        "111111111111111111"
      );
    });
  });

  describe("#exercise", () => {
    let callOptionID, putOptionID;

    beforeEach(async function () {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];

      const callRes = await this.adapter.purchase(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        CALL_OPTION_TYPE,
        ether("1"),
        {
          from: user,
          value: ether("0.028675"),
        }
      );
      callOptionID = callRes.receipt.logs[0].args.optionID;

      const putRes = await this.adapter.purchase(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        PUT_OPTION_TYPE,
        ether("1"),
        {
          from: user,
          value: ether("0.028675"),
        }
      );
      putOptionID = putRes.receipt.logs[0].args.optionID;

      // Load some ETH into the contract for payouts
      await web3.eth.sendTransaction({
        from: admin,
        to: this.ethOptions.address,
        value: ether("10"),
      });
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("exercises options with 0 profit", async function () {
      const res = await this.adapter.exercise(
        this.ethOptions.address,
        callOptionID,
        0,
        { from: user }
      );
      expectEvent(res, "Exercised", {
        caller: user,
        optionID: "0",
        amount: "0",
        exerciseProfit: "0",
      });
    });

    it("reverts when exercising twice", async function () {
      await this.adapter.exercise(this.ethOptions.address, callOptionID, 0, {
        from: user,
      });
      await expectRevert(
        this.adapter.exercise(this.ethOptions.address, callOptionID, 0, {
          from: user,
        }),
        "Wrong state"
      );
    });

    it("reverts when past expiry", async function () {
      await time.increaseTo(this.expiry + 1);

      await expectRevert(
        this.adapter.exercise(this.ethOptions.address, callOptionID, 0, {
          from: user,
        }),
        "Option has expired"
      );
    });

    it("exercises the call option", async function () {
      await this.ethOptions.setCurrentPrice(ether("550"));

      const revenue = ether("0.090909090909090909");

      const hegicTracker = await balance.tracker(this.ethOptions.address);
      const adapterTracker = await balance.tracker(this.adapter.address);
      const userTracker = await balance.tracker(user);

      const res = await this.adapter.exercise(
        this.ethOptions.address,
        callOptionID,
        0,
        {
          from: user,
          gasPrice,
        }
      );

      const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
      const profit = revenue.sub(gasFee);

      assert.equal((await userTracker.delta()).toString(), profit.toString());
      assert.equal(
        (await hegicTracker.delta()).toString(),
        "-" + revenue.toString()
      );

      // make sure doji doesn't accidentally retain any ether
      assert.equal((await adapterTracker.delta()).toString(), "0");
    });

    it("exercises the put option", async function () {
      await this.ethOptions.setCurrentPrice(ether("450"));

      const revenue = new BN("111111111111111111");

      const hegicTracker = await balance.tracker(this.ethOptions.address);
      const adapterTracker = await balance.tracker(this.adapter.address);
      const userTracker = await balance.tracker(user);

      const res = await this.adapter.exercise(
        this.ethOptions.address,
        putOptionID,
        0,
        {
          from: user,
          gasPrice,
        }
      );
      const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
      const profit = revenue.sub(gasFee);

      assert.equal((await userTracker.delta()).toString(), profit.toString());
      assert.equal(
        (await hegicTracker.delta()).toString(),
        "-" + revenue.toString()
      );

      // make sure doji doesn't accidentally retain any ether
      assert.equal((await adapterTracker.delta()).toString(), "0");
    });
  });
});
