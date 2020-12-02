const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  BN,
  time,
  constants,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { deployProxy } = require("./utils");
const { encodeCall } = require("@openzeppelin/upgrades");
const balance = require("@openzeppelin/test-helpers/src/balance");
const DojimaVolatility = contract.fromArtifact("DojiVolatility");
const Factory = contract.fromArtifact("DojimaFactory");
const MockHegicETHOptions = contract.fromArtifact("MockHegicETHOptions");

describe("VolatilityStraddle", () => {
  const [admin, owner, user] = accounts;
  const settlementFeeRecipient = "0x0000000000000000000000000000000000000420";
  const pool = "0x0000000000000000000000000000000000000069";
  const gasPrice = web3.utils.toWei("10", "gwei");
  let self, snapshotId;

  before(async function () {
    self = this;
    this.name = "VOL 500 25/12/2020";
    this.symbol = "VOL-500-251220";
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    this.expiry = Math.floor(expiryDate.getTime() / 1000);

    this.strikePrice = ether("500");

    this.hegicOptions = await MockHegicETHOptions.new(
      pool,
      settlementFeeRecipient,
      { from: owner }
    );
    await this.hegicOptions.setCurrentPrice(ether("500"));

    this.factory = await deployProxy(
      Factory,
      admin,
      ["address", "address", "address", "address"],
      [owner, constants.ZERO_ADDRESS, admin, constants.ZERO_ADDRESS]
    );

    this.instrumentLogic = await DojimaVolatility.new({ from: admin });

    const initTypes = [
      "address",
      "string",
      "string",
      "uint256",
      "uint256",
      "address",
    ];
    const initArgs = [
      owner,
      this.name,
      this.symbol,
      this.expiry,
      this.strikePrice.toString(),
      this.hegicOptions.address,
    ];
    const initBytes = encodeCall("initialize", initTypes, initArgs);
    const res = await this.factory.newInstrument(
      this.instrumentLogic.address,
      initBytes,
      {
        from: owner,
      }
    );

    this.contract = await DojimaVolatility.at(
      res.logs[1].args.instrumentAddress
    );

    await time.increaseTo(Math.floor(Date.now() / 1000));
  });

  describe("#getHegicCost", () => {
    it("returns the total cost", async function () {
      const {
        totalCost,
        costOfCall,
        costOfPut,
      } = await this.contract.getHegicCost(ether("1"));
      assert.equal(totalCost.toString(), ether("0.05735"));
      assert.equal(costOfCall.toString(), ether("0.028675"));
      assert.equal(costOfPut.toString(), ether("0.028675"));
    });
  });

  describe("#buyInstrument", () => {
    beforeEach(async () => {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("reverts when not enough value is passed", async function () {
      await expectRevert(
        this.contract.buyInstrument(ether("1"), {
          from: user,
          value: ether("0.01"),
        }),
        "Value does not cover total cost"
      );
    });

    it("reverts when buying after expiry", async function () {
      await time.increaseTo(this.expiry + 1);

      await expectRevert(
        this.contract.buyInstrument(ether("1"), {
          from: user,
          value: ether("0.01"),
        }),
        "Cannot buy instrument after expiry"
      );
    });

    it("buys options on hegic", async function () {
      const { costOfCall, costOfPut } = await this.contract.getHegicCost(
        ether("1")
      );

      const res = await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });

      expectEvent(res, "PositionCreated", {
        account: user,
        positionID: "0",
        costOfCall,
        costOfPut,
        callOptionProtocol: "2",
        putOptionProtocol: "2",
        callOptionAmount: ether("1"),
        putOptionAmount: ether("1"),
        callOptionID: "0",
        putOptionID: "1",
      });

      const position = await this.contract.instrumentPositions(user, 0);

      assert.equal(position.callProtocol, "2");
      assert.equal(position.callAmount.toString(), ether("1"));
      assert.equal(position.callOptionID, "0");
      assert.equal(position.putProtocol, "2");
      assert.equal(position.putAmount.toString(), ether("1"));
      assert.equal(position.putOptionID, "1");
    });

    it("does not exceed gas limit budget", async function () {
      const firstRes = await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });
      const secondRes = await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });
      assert.isAtMost(firstRes.receipt.gasUsed, 650000);
      assert.isAtMost(secondRes.receipt.gasUsed, 550000);
    });
  });

  describe("#exercise", () => {
    let positionID;

    beforeEach(async function () {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];

      const res = await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });
      positionID = res.receipt.logs[0].args.positionID;

      // Load some ETH into the contract for payouts
      await web3.eth.sendTransaction({
        from: admin,
        to: this.hegicOptions.address,
        value: ether("10"),
      });
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("exercises options with 0 profit", async function () {
      const res = await this.contract.exercise(positionID, { from: user });
      expectEvent(res, "Exercised", {
        account: user,
        positionID: "0",
        totalProfit: "0",
      });
    });

    it("reverts when exercising twice", async function () {
      await this.contract.exercise(positionID, { from: user });

      await expectRevert(
        this.contract.exercise(positionID, { from: user }),
        "Already exercised"
      );
    });

    it("reverts when past expiry", async function () {
      await time.increaseTo(this.expiry + 1);

      await expectRevert(
        this.contract.exercise(positionID, { from: user }),
        "Already expired"
      );
    });

    it("exercises the call option", async function () {
      await this.hegicOptions.setCurrentPrice(ether("550"));

      const revenue = ether("0.090909090909090909");

      const hegicTracker = await balance.tracker(this.hegicOptions.address);
      const dojiTracker = await balance.tracker(this.contract.address);
      const userTracker = await balance.tracker(user);

      const res = await this.contract.exercise(positionID, {
        from: user,
        gasPrice,
      });
      const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
      const profit = revenue.sub(gasFee);

      assert.equal((await userTracker.delta()).toString(), profit.toString());
      assert.equal(
        (await hegicTracker.delta()).toString(),
        "-" + revenue.toString()
      );

      // make sure doji doesn't accidentally retain any ether
      assert.equal((await dojiTracker.delta()).toString(), "0");
    });

    it("exercises the put option", async function () {
      await this.hegicOptions.setCurrentPrice(ether("450"));

      const revenue = new BN("111111111111111111");

      const hegicTracker = await balance.tracker(this.hegicOptions.address);
      const dojiTracker = await balance.tracker(this.contract.address);
      const userTracker = await balance.tracker(user);

      const res = await this.contract.exercise(positionID, {
        from: user,
        gasPrice,
      });
      const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
      const profit = revenue.sub(gasFee);

      assert.equal((await userTracker.delta()).toString(), profit.toString());
      assert.equal(
        (await hegicTracker.delta()).toString(),
        "-" + revenue.toString()
      );

      // make sure doji doesn't accidentally retain any ether
      assert.equal((await dojiTracker.delta()).toString(), "0");
    });
  });

  describe("#calculateHegicExerciseProfit", () => {
    let positionID;

    beforeEach(async function () {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];

      const res = await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });
      positionID = res.receipt.logs[0].args.positionID;
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("calculates profit for call option", async function () {
      const { callOptionID } = await this.contract.instrumentPositions(
        user,
        positionID
      );

      // should be zero if price == strike
      assert.equal(
        await this.contract.calculateHegicExerciseProfit(callOptionID),
        "0"
      );

      // should be zero if price < strike
      await this.hegicOptions.setCurrentPrice(ether("490"));
      assert.equal(
        await this.contract.calculateHegicExerciseProfit(callOptionID),
        "0"
      );

      // should be positive if price > strike
      await this.hegicOptions.setCurrentPrice(ether("550"));

      assert.equal(
        (
          await this.contract.calculateHegicExerciseProfit(callOptionID)
        ).toString(),
        ether("0.090909090909090909")
      );
    });

    it("calculates profit for put option", async function () {
      const { putOptionID } = await this.contract.instrumentPositions(
        user,
        positionID
      );

      // should be zero if price == strike
      assert.equal(
        await this.contract.calculateHegicExerciseProfit(putOptionID),
        "0"
      );

      // should be zero if price > strike
      await this.hegicOptions.setCurrentPrice(ether("550"));
      assert.equal(
        await this.contract.calculateHegicExerciseProfit(putOptionID),
        "0"
      );

      // should be zero if price < strike
      await this.hegicOptions.setCurrentPrice(ether("450"));
      assert.equal(
        (
          await this.contract.calculateHegicExerciseProfit(putOptionID)
        ).toString(),
        "111111111111111111"
      );
    });
  });

  describe("#numOfPositions", () => {
    it("gets the number of positions", async function () {
      assert.equal(await this.contract.numOfPositions(user), 0);
      await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });
      assert.equal(await this.contract.numOfPositions(user), 1);
    });
  });

  describe("#deposit", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.deposit(1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#mint", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.mint(1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#depositAndMint", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.depositAndMint(1, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#depositMintAndSell", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.depositMintAndSell(1, 1, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#settle", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.settle({ from: user }),
        "Not implemented"
      );
    });
  });

  describe("#repayDebt", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.repayDebt(constants.ZERO_ADDRESS, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#withdrawAfterExpiry", () => {
    it("raises not implemented exception", async function () {
      await expectRevert(
        this.contract.withdrawAfterExpiry({ from: user }),
        "Not implemented"
      );
    });
  });
});
