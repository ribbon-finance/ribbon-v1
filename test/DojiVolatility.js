const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  BN,
  time,
  constants,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  balance,
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils");
const { encodeCall } = require("@openzeppelin/upgrades");
const DojimaVolatility = contract.fromArtifact("DojiVolatility");
const IERC20 = contract.fromArtifact("IERC20");
const IOToken = contract.fromArtifact("IOToken");
const IHegicETHOptions = contract.fromArtifact("IHegicETHOptions");
const IHegicBTCOptions = contract.fromArtifact("IHegicBTCOptions");

const [admin, owner, user] = accounts;
const gasPrice = web3.utils.toWei("10", "gwei");

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
const HEGIC_PROTOCOL = "HEGIC";
const OPYN_V1_PROTOCOL = "OPYN_V1";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";

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
    exerciseProfit: new BN("166196590272271"),
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
        exerciseProfit,
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
      this.exerciseProfit = exerciseProfit;

      this.totalPremium = premiums.reduce((a, b) => a.add(b), new BN("0"));

      const { factory, hegicAdapter, opynV1Adapter } = await getDefaultArgs(
        admin,
        owner,
        user
      );
      this.factory = factory;
      this.hegicAdapter = hegicAdapter;
      this.opynV1Adapter = opynV1Adapter;
      this.instrumentLogic = await DojimaVolatility.new({ from: admin });

      if (this.underlying === ETH_ADDRESS) {
        this.hegicOptions = await IHegicETHOptions.at(HEGIC_ETH_OPTIONS);
      } else if (underlying === WBTC_ADDRESS) {
        this.hegicOptions = await IHegicBTCOptions.at(HEGIC_WBTC_OPTIONS);
      } else {
        throw new Error(`No underlying found ${this.underlying}`);
      }

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

        let i = 0;
        for (const venue of this.venues) {
          const expectedOptionType = this.optionTypes[i];
          const strikePrice =
            expectedOptionType === PUT_OPTION_TYPE
              ? this.putStrikePrice
              : this.callStrikePrice;
          const hegicScaledStrikePrice = strikePrice.div(new BN("10000000000"));
          const purchaseAmount = this.amounts[i];
          const optionType = this.optionTypes[i];

          if (venue === "HEGIC") {
            const {
              holder,
              strike,
              amount,
              lockedAmount,
              expiration,
              optionType,
            } = await this.hegicOptions.options(this.optionIDs[i]);

            assert.equal(holder, this.hegicAdapter.address);
            assert.equal(strike.toString(), hegicScaledStrikePrice);
            assert.equal(lockedAmount.toString(), purchaseAmount);
            assert.equal(amount.toString(), purchaseAmount);
            assert.equal(expiration, this.expiry);
            assert.equal(optionType, expectedOptionType);
          } else if (venue === "OPYN_V1") {
            const oTokenAddress = await this.opynV1Adapter.lookupOToken(
              this.underlying,
              this.strikeAsset,
              this.expiry,
              strikePrice,
              optionType
            );

            const oTokenERC20 = await IERC20.at(oTokenAddress);
            const decimals = await (await IOToken.at(oTokenAddress)).decimals();
            const scaledBy = new BN("18").sub(decimals);
            assert.equal(
              (
                await oTokenERC20.balanceOf(this.opynV1Adapter.address)
              ).toString(),
              purchaseAmount.div(new BN("10").pow(scaledBy))
            );

            // check that the instrument contract doesnt retain any oTokens
            // and that the user doesnt receive the oTokens
            assert.equal(
              (await oTokenERC20.balanceOf(this.contract.address)).toString(),
              "0"
            );
            assert.equal((await oTokenERC20.balanceOf(user)).toString(), "0");
          } else {
            throw new Error(`No venue found ${venue}`);
          }
          i++;
        }
      });

      it("does not exceed gas limit budget", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
          {
            from: user,
            value: this.totalPremium,
          }
        );
        assert.isAtMost(res.receipt.gasUsed, 650000);
      });
    });

    describe("#exercisePosition", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = (await helper.takeSnapshot())["result"];
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
          {
            from: user,
            value: this.totalPremium,
          }
        );
        this.positionID = 0;
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      // after(async () => {
      //   await helper.revertToSnapShot(initSnapshotId);
      // });

      it("reverts when exercising twice", async function () {
        await this.contract.exercisePosition(this.positionID, { from: user });
        await expectRevert(
          this.contract.exercisePosition(this.positionID, { from: user }),
          "Already exercised"
        );
      });

      it("reverts when past expiry", async function () {
        await time.increaseTo(this.expiry + 1);
        await expectRevert(
          this.contract.exercisePosition(this.positionID, { from: user }),
          "Already expired"
        );
      });

      it("exercises one of the options", async function () {
        const userTracker = await balance.tracker(user, "wei");

        const res = await this.contract.exercisePosition(this.positionID, {
          from: user,
          gasPrice,
        });
        const gasUsed = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));

        expectEvent(res, "Exercised", {
          account: user,
          positionID: this.positionID.toString(),
          totalProfit: this.exerciseProfit,
        });

        if (this.underlying == constants.ZERO_ADDRESS) {
          assert.equal(
            (await userTracker.delta()).toString(),
            this.exerciseProfit.sub(gasUsed).toString()
          );
        } else {
          const underlying = await IERC20.at(this.underlying);
          assert.equal(
            (await underlying.balanceOf(user)).toString(),
            this.exerciseProfit
          );
        }
      });
    });

    describe("#numOfPositions", () => {
      let snapshotId;

      beforeEach(async function () {
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
          {
            from: user,
            value: this.totalPremium,
          }
        );
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("gets the number of positions", async function () {
        assert.equal(await this.contract.numOfPositions(user), 1);
      });
    });
  });
}
