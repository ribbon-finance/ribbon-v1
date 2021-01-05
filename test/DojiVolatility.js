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
const { wmul } = require("../scripts/helpers/utils");

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
  /**
   * Current price for ETH-USD = ~$545
   * Current price for UNI-USD = $3.35
   * Current price for BTC-USD = ~$18,000
   * Current price for YFI-USD = ~$25,500
   * Date is 9 December 2020
   */

  // // Hegic OTM Put, Opyn ITM Call
  // behavesLikeDojiVolatility({
  //   name: "ETH VOL 500 25/12/2020",
  //   symbol: "ETH-VOL-500-251220",
  //   expiry: "1608883200",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   venues: [HEGIC_PROTOCOL, OPYN_V1_PROTOCOL],
  //   optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
  //   amounts: [ether("1"), ether("1")],
  //   strikePrices: [ether("500"), ether("500")],
  //   premiums: [new BN("90554751405166144"), new BN("106656198359758724")],
  //   purchaseAmount: ether("1"),
  //   optionIDs: ["1685", "0"],
  //   exerciseProfit: new BN("83090832707945605"),
  //   actualExerciseProfit: new BN("83090832707945605"),
  // });

  // // Hegic ITM Put, Opyn OTM Call
  // behavesLikeDojiVolatility({
  //   name: "ETH VOL 640 25/12/2020",
  //   symbol: "ETH-VOL-640-251220",
  //   expiry: "1608883200",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   venues: [HEGIC_PROTOCOL, OPYN_V1_PROTOCOL],
  //   optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
  //   amounts: [ether("1"), ether("1")],
  //   strikePrices: [ether("640"), ether("640")],
  //   premiums: [new BN("282158628268144018"), new BN("22636934749846005")],
  //   purchaseAmount: ether("1"),
  //   optionIDs: ["1685", "0"],
  //   exerciseProfit: new BN("169048546469531353"),
  //   actualExerciseProfit: new BN("169048546469531353"),
  // });

  // // Hegic OTM Call, Opyn ITM Put
  // behavesLikeDojiVolatility({
  //   name: "ETH VOL 600 18/12/2020",
  //   symbol: "ETH-VOL-600-181220",
  //   expiry: "1608278400",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   venues: [OPYN_V1_PROTOCOL, HEGIC_PROTOCOL],
  //   optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
  //   amounts: [ether("1"), ether("1")],
  //   strikePrices: [ether("600"), ether("600")],
  //   premiums: [new BN("106920070230577145"), new BN("70356774928712500")],
  //   purchaseAmount: ether("1"),
  //   optionIDs: ["0", "1685"],
  //   exerciseProfit: new BN("91797789832984586"),
  //   actualExerciseProfit: new BN("91796148075270874"),
  // });

  // // Hegic ITM Put, Opyn OTM Put
  // behavesLikeDojiVolatility({
  //   name: "ETH VOL 520 25/12/2020",
  //   symbol: "ETH-VOL-520-181220",
  //   expiry: "1608883200",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   venues: [OPYN_V1_PROTOCOL, HEGIC_PROTOCOL],
  //   optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
  //   amounts: [ether("1"), ether("1")],
  //   strikePrices: [ether("520"), ether("520")],
  //   premiums: [new BN("38993035115930594"), new BN("153004632806909621")],
  //   purchaseAmount: ether("1"),
  //   optionIDs: ["0", "1685"],
  //   exerciseProfit: new BN("50148055993505775"),
  //   actualExerciseProfit: new BN("50148055993505775"),
  // });

  // Hegic ITM Put, Hegic OTM Call
  behavesLikeDojiVolatility({
    name: "ETH VOL 510 25/12/2020",
    symbol: "ETH-VOL-510-181220",
    expiry: "1608883200",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [ether("1"), ether("1")],
    strikePrices: [ether("510"), ether("510")],
    premiums: [new BN("92165846433269467"), new BN("173091733537915731")],
    purchaseAmount: ether("1"),
    optionIDs: ["1685", "1686"],
    exerciseProfit: new BN("68414439532092202"),
    actualExerciseProfit: new BN("68414439532092202"),
  });

  // Hegic OTM Put, Hegic ITM Call
  behavesLikeDojiVolatility({
    name: "ETH VOL 560 25/12/2020",
    symbol: "ETH-VOL-560-181220",
    expiry: "1608883200",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [ether("1"), ether("1")],
    strikePrices: [ether("560"), ether("560")],
    premiums: [new BN("123138799734626016"), new BN("96223964183875000")],
    purchaseAmount: ether("1"),
    optionIDs: ["1685", "1686"],
    exerciseProfit: new BN("22917478160839934"),
    actualExerciseProfit: new BN("22917478160839934"),
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
        venues,
        optionTypes,
        amounts,
        purchaseAmount,
        premiums,
        optionIDs,
        exerciseProfit,
        actualExerciseProfit,
        strikePrices,
      } = params;
      this.name = name;
      this.symbol = symbol;
      this.expiry = expiry;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.strikePrices = strikePrices;
      this.venues = venues;
      this.optionTypes = optionTypes;
      this.amounts = amounts;
      this.purchaseAmount = purchaseAmount;
      this.premiums = premiums;
      this.optionIDs = optionIDs;
      this.exerciseProfit = exerciseProfit;
      this.actualExerciseProfit = actualExerciseProfit;

      this.totalPremium = premiums.reduce((a, b) => a.add(b), new BN("0"));

      const {
        factory,
        hegicAdapter,
        protocolAdapterLib,
      } = await getDefaultArgs(admin, owner, user);
      this.factory = factory;
      this.hegicAdapter = hegicAdapter;

      await DojimaVolatility.detectNetwork();
      await DojimaVolatility.link(
        "ProtocolAdapter",
        protocolAdapterLib.address
      );
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
      ];
      const initArgs = [
        owner,
        this.factory.address,
        this.name,
        this.symbol,
        this.underlying,
        this.strikeAsset,
        this.expiry,
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

    describe("#cost", () => {
      beforeEach(async () => {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("returns the total cost of the position", async function () {
        assert.equal(
          (
            await this.contract.cost(
              this.venues,
              this.optionTypes,
              this.amounts,
              this.strikePrices
            )
          ).toString(),
          this.totalPremium
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
            [this.strikePrices[0]],
            {
              from: user,
              value: this.premiums[0],
            }
          ),
          "Must have at least 2 venues"
        );
      });

      it("reverts when passed 2 options of the same type", async function () {
        await expectRevert(
          this.contract.buyInstrument(
            [this.venues[0], this.venues[0]],
            [this.optionTypes[0], this.optionTypes[0]],
            [this.amounts[0], this.amounts[0]],
            [this.strikePrices[0], this.strikePrices[0]],
            {
              from: user,
              value: this.premiums[0].mul(new BN("3")), // just multiply premium by 3 because doubling the premiums sometimes doesnt work
            }
          ),
          "Must have both put and call options"
        );
      });

      it("reverts when buying after expiry", async function () {
        await time.increaseTo(this.expiry + 1);

        await expectRevert(
          this.contract.buyInstrument(
            this.venues,
            this.optionTypes,
            this.amounts,
            this.strikePrices,
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
          this.strikePrices,
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
          const strikePrice = this.strikePrices[i];
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
            assert.equal(
              (
                await oTokenERC20.balanceOf(this.opynV1Adapter.address)
              ).toString(),
              await convertStandardPurchaseAmountToOTokenAmount(
                oTokenAddress,
                optionType,
                this.purchaseAmount,
                strikePrice
              )
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
          this.strikePrices,
          {
            from: user,
            value: this.totalPremium,
          }
        );
        assert.isAtMost(res.receipt.gasUsed, 700000);
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
          this.strikePrices,
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
            this.actualExerciseProfit.sub(gasUsed).toString()
          );
        } else {
          const underlying = await IERC20.at(this.underlying);
          assert.equal(
            (await underlying.balanceOf(user)).toString(),
            this.actualExerciseProfit
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
          this.strikePrices,
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

async function convertStandardPurchaseAmountToOTokenAmount(
  oTokenAddress,
  optionType,
  purchaseAmount,
  strikePrice
) {
  const decimals = await (await IOToken.at(oTokenAddress)).decimals();
  const scaledBy = new BN("18").sub(decimals);
  const amount =
    optionType === CALL_OPTION_TYPE
      ? wmul(purchaseAmount, strikePrice)
      : purchaseAmount;
  return amount.div(new BN("10").pow(scaledBy));
}
