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

const [admin, owner, user] = accounts;
const gasPrice = web3.utils.toWei("10", "gwei");

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
const HEGIC_PROTOCOL = "HEGIC";
const OPYN_V1_PROTOCOL = "OPYN_V1";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

describe("DojiVolatility", () => {
  behavesLikeDojiVolatility({
    name: "VOL 500 25/12/2020",
    symbol: "VOL-500-251220",
    expiry: "1608883200",
    callStrikePrice: ether("500"),
    putStrikePrice: ether("500"),
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, OPYN_V1_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [ether("1"), ether("1")],
    premiums: [new BN("193251662956618630"), new BN("210335735004969")],
    purchaseAmount: ether("1"),
    optionIDs: ["1685", "0"],
  });
});

function behavesLikeDojiVolatility(params) {
  describe(`${params.name}`, () => {
    let snapshotId, initSnapshotId;

    before(async function () {
      const {
        name,
        symbol,
        expiry,
        underlying,
        strikeAsset,
        callStrikePrice,
        putStrikePrice,
        venues,
        optionTypes,
        amounts,
        purchaseAmount,
        premiums,
        optionIDs,
      } = params;
      this.name = name;
      this.symbol = symbol;
      this.expiry = expiry;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.callStrikePrice = callStrikePrice;
      this.putStrikePrice = putStrikePrice;
      this.venues = venues;
      this.optionTypes = optionTypes;
      this.amounts = amounts;
      this.purchaseAmount = purchaseAmount;
      this.premiums = premiums;
      this.optionIDs = optionIDs;

      this.totalPremium = premiums.reduce((a, b) => a.add(b), new BN("0"));

      const { factory } = await getDefaultArgs(admin, owner, user);
      this.factory = factory;
      this.instrumentLogic = await DojimaVolatility.new({ from: admin });

      const initTypes = [
        "address",
        "address",
        "string",
        "string",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
      ];
      const initArgs = [
        owner,
        this.factory.address,
        this.name,
        this.symbol,
        this.underlying,
        this.strikeAsset,
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

    describe("#getBestTrade", () => {
      beforeEach(async () => {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("gets the venues to trade", async function () {
        const {
          venues,
          optionTypes,
          amounts,
          premiums,
        } = await this.contract.getBestTrade(this.purchaseAmount);

        assert.deepEqual(venues, this.venues);
        assert.deepEqual(
          optionTypes.map((i) => i.toNumber()),
          this.optionTypes
        );
        assert.deepEqual(
          amounts.map((a) => a.toString()),
          this.amounts.map((a) => a.toString())
        );
        assert.deepEqual(
          premiums.map((a) => a.toString()),
          this.premiums.map((a) => a.toString())
        );
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

      it("reverts when passed less than 2 venues", async function () {
        await expectRevert(
          this.contract.buyInstrument(
            [this.venues[0]],
            [this.optionTypes[0]],
            [this.amounts[0]],
            {
              from: user,
              value: this.totalPremium,
            }
          ),
          "Must have at least 2 venues"
        );
      });

      it("reverts when buying after expiry", async function () {
        await time.increaseTo(this.expiry + 1);

        await expectRevert(
          this.contract.buyInstrument(
            this.venues,
            this.optionTypes,
            this.amounts,
            {
              from: user,
              value: this.totalPremium,
            }
          ),
          "Cannot purchase after expiry"
        );
      });

      it("buys instrument", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
          {
            from: user,
            value: this.totalPremium,
          }
        );

        expectEvent(res, "PositionCreated", {
          account: user,
          positionID: "0",
          venues: this.venues,
        });

        const { optionTypes, amounts } = res.logs[0].args;
        assert.deepEqual(
          optionTypes.map((o) => o.toNumber()),
          this.optionTypes
        );
        assert.deepEqual(
          amounts.map((a) => a.toString()),
          this.amounts.map((a) => a.toString())
        );

        const position = await this.contract.instrumentPosition(user, 0);

        assert.equal(position.exercised, false);
        assert.deepEqual(position.venues, this.venues);
        assert.deepEqual(
          position.optionTypes.map((o) => o.toString()),
          this.optionTypes.map((o) => o.toString())
        );
        assert.deepEqual(
          position.amounts.map((a) => a.toString()),
          this.amounts.map((a) => a.toString())
        );
        assert.deepEqual(position.optionIDs, this.optionIDs);
      });

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
}
