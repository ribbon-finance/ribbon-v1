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
const { getDefaultArgs } = require("./utils");
const { encodeCall } = require("@openzeppelin/upgrades");
const balance = require("@openzeppelin/test-helpers/src/balance");
const DojimaVolatility = contract.fromArtifact("DojiVolatility");
const Factory = contract.fromArtifact("DojiFactory");

describe("DojiVolatility", () => {
  const [admin, owner, user] = accounts;
  const settlementFeeRecipient = "0x0000000000000000000000000000000000000420";
  const pool = "0x0000000000000000000000000000000000000069";
  const gasPrice = web3.utils.toWei("10", "gwei");
  let self, snapshotId, initSnapshotId;

  before(async function () {
    self = this;
    this.name = "VOL 500 25/12/2020";
    this.symbol = "VOL-500-251220";
    const startTime = (await web3.eth.getBlock("latest")).timestamp;
    this.expiry = startTime + 60 * 60 * 24 * 2; // 2 days from now
    this.callStrikePrice = ether("500");
    this.putStrikePrice = ether("500");

    const { factory } = await getDefaultArgs(admin, owner, user);
    this.factory = factory;
    this.instrumentLogic = await DojimaVolatility.new({ from: admin });

    const initTypes = [
      "address",
      "address",
      "string",
      "string",
      "uint256",
      "uint256",
      "uint256",
    ];
    const initArgs = [
      owner,
      this.factory.address,
      this.name,
      this.symbol,
      this.expiry,
      this.callStrikePrice.toString(),
      this.putStrikePrice.toString(),
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

    const snapShot = await helper.takeSnapshot();
    initSnapshotId = snapShot["result"];
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
  });

  describe("#buyInstrument", () => {
    beforeEach(async () => {
      const snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    // it("reverts when not enough value is passed", async function () {
    //   await expectRevert(
    //     this.contract.buyInstrument(ether("1"), {
    //       from: user,
    //       value: ether("0.01"),
    //     }),
    //     "Value does not cover total cost"
    //   );
    // });

    // it("reverts when buying after expiry", async function () {
    //   await time.increaseTo(this.expiry + 1);

    //   await expectRevert(
    //     this.contract.buyInstrument(ether("1"), {
    //       from: user,
    //       value: ether("0.01"),
    //     }),
    //     "Cannot buy instrument after expiry"
    //   );
    // });

    it("buys options on hegic", async function () {});

    // it("does not exceed gas limit budget", async function () {
    //   const firstRes = await this.contract.buyInstrument(ether("1"), {
    //     from: user,
    //     value: ether("0.05735"),
    //   });
    //   const secondRes = await this.contract.buyInstrument(ether("1"), {
    //     from: user,
    //     value: ether("0.05735"),
    //   });
    //   assert.isAtMost(firstRes.receipt.gasUsed, 650000);
    //   assert.isAtMost(secondRes.receipt.gasUsed, 550000);
    // });
  });

  // describe("#exercise", () => {
  //   let positionID;

  //   beforeEach(async function () {
  //     const snapShot = await helper.takeSnapshot();
  //     snapshotId = snapShot["result"];

  //     const res = await this.contract.buyInstrument(ether("1"), {
  //       from: user,
  //       value: ether("0.05735"),
  //     });
  //     positionID = res.receipt.logs[0].args.positionID;

  //     // Load some ETH into the contract for payouts
  //     await web3.eth.sendTransaction({
  //       from: admin,
  //       to: this.hegicOptions.address,
  //       value: ether("10"),
  //     });
  //   });

  //   afterEach(async () => {
  //     await helper.revertToSnapShot(snapshotId);
  //   });

  //   it("exercises options with 0 profit", async function () {
  //     const res = await this.contract.exercise(positionID, { from: user });
  //     expectEvent(res, "Exercised", {
  //       account: user,
  //       positionID: "0",
  //       totalProfit: "0",
  //     });
  //   });

  //   it("reverts when exercising twice", async function () {
  //     await this.contract.exercise(positionID, { from: user });

  //     await expectRevert(
  //       this.contract.exercise(positionID, { from: user }),
  //       "Already exercised"
  //     );
  //   });

  //   it("reverts when past expiry", async function () {
  //     await time.increaseTo(this.expiry + 1);

  //     await expectRevert(
  //       this.contract.exercise(positionID, { from: user }),
  //       "Already expired"
  //     );
  //   });

  //   it("exercises the call option", async function () {
  //     await this.hegicOptions.setCurrentPrice(ether("550"));

  //     const revenue = ether("0.090909090909090909");

  //     const hegicTracker = await balance.tracker(this.hegicOptions.address);
  //     const dojiTracker = await balance.tracker(this.contract.address);
  //     const userTracker = await balance.tracker(user);

  //     const res = await this.contract.exercise(positionID, {
  //       from: user,
  //       gasPrice,
  //     });
  //     const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
  //     const profit = revenue.sub(gasFee);

  //     assert.equal((await userTracker.delta()).toString(), profit.toString());
  //     assert.equal(
  //       (await hegicTracker.delta()).toString(),
  //       "-" + revenue.toString()
  //     );

  //     // make sure doji doesn't accidentally retain any ether
  //     assert.equal((await dojiTracker.delta()).toString(), "0");
  //   });

  //   it("exercises the put option", async function () {
  //     await this.hegicOptions.setCurrentPrice(ether("450"));

  //     const revenue = new BN("111111111111111111");

  //     const hegicTracker = await balance.tracker(this.hegicOptions.address);
  //     const dojiTracker = await balance.tracker(this.contract.address);
  //     const userTracker = await balance.tracker(user);

  //     const res = await this.contract.exercise(positionID, {
  //       from: user,
  //       gasPrice,
  //     });
  //     const gasFee = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
  //     const profit = revenue.sub(gasFee);

  //     assert.equal((await userTracker.delta()).toString(), profit.toString());
  //     assert.equal(
  //       (await hegicTracker.delta()).toString(),
  //       "-" + revenue.toString()
  //     );

  //     // make sure doji doesn't accidentally retain any ether
  //     assert.equal((await dojiTracker.delta()).toString(), "0");
  //   });
  // });

  describe("#numOfPositions", () => {
    // it("gets the number of positions", async function () {
    //   assert.equal(await this.contract.numOfPositions(user), 0);
    //   await this.contract.buyInstrument(ether("1"), {
    //     from: user,
    //     value: ether("0.05735"),
    //   });
    //   assert.equal(await this.contract.numOfPositions(user), 1);
    // });
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
