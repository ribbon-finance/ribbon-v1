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
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const MockDojiFactory = contract.fromArtifact("MockDojiFactory");
const IHegicETHOptions = contract.fromArtifact("IHegicETHOptions");
const IHegicBTCOptions = contract.fromArtifact("IHegicBTCOptions");

const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const [admin, owner, user] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("HegicAdapter", () => {
  let initSnapshotId, snapshotId;
  const gasPrice = web3.utils.toWei("10", "gwei");

  before(async function () {
    this.protocolName = "HEGIC";
    this.nonFungible = true;

    // we assume the user account is the calling instrument
    this.factory = await MockDojiFactory.new({ from: owner });
    await this.factory.setInstrument(user, { from: user });

    this.adapter = await HegicAdapter.new(
      HEGIC_ETH_OPTIONS,
      HEGIC_WBTC_OPTIONS,
      ETH_ADDRESS,
      WBTC_ADDRESS
    );
    await this.adapter.initialize(owner, this.factory.address);

    this.hegicETHOptions = await IHegicETHOptions.at(HEGIC_ETH_OPTIONS);
    this.hegicWBTCOptions = await IHegicBTCOptions.at(HEGIC_WBTC_OPTIONS);

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

  behavesLikeHegicOptions({
    optionName: "ETH CALL ITM",
    underlying: ETH_ADDRESS,
    strikeAsset: ETH_ADDRESS,
    strikePrice: ether("500"),
    premium: new BN("130759818438591130"),
    purchaseAmount: ether("1"),
    optionType: CALL_OPTION_TYPE,
    expectedOptionID: "1685",
    itmStrikePrice: ether("500"),
    otmStrikePrice: ether("600"),
    exerciseProfit: new BN("86680823070678630"),
  });

  behavesLikeHegicOptions({
    optionName: "ETH PUT ITM",
    underlying: ETH_ADDRESS,
    strikeAsset: ETH_ADDRESS,
    strikePrice: ether("600"),
    premium: new BN("140095483573495796"),
    purchaseAmount: ether("1"),
    optionType: PUT_OPTION_TYPE,
    expectedOptionID: "1685",
    itmStrikePrice: ether("600"),
    otmStrikePrice: ether("500"),
    exerciseProfit: new BN("95983012315185643"),
  });

  function behavesLikeHegicOptions(params) {
    describe(`${params.optionName}`, () => {
      before(async function () {
        const {
          underlying,
          strikeAsset,
          expiry,
          strikePrice,
          premium,
          purchaseAmount,
          optionType,
          expectedOptionID,
          itmStrikePrice,
          otmStrikePrice,
          exerciseProfit,
        } = params;
        this.underlying = underlying;
        this.strikeAsset = strikeAsset;
        this.startTime = (await web3.eth.getBlock("latest")).timestamp;
        this.expiry = expiry || this.startTime + 60 * 60 * 24 * 2; // 2 days from now
        this.strikePrice = strikePrice;
        this.premium = premium;
        this.purchaseAmount = purchaseAmount;
        this.optionType = optionType;
        this.expectedOptionID = expectedOptionID;
        this.itmStrikePrice = itmStrikePrice;
        this.otmStrikePrice = otmStrikePrice;
        this.exerciseProfit = exerciseProfit;
      });

      describe("#premium", () => {
        it("gets premium of option", async function () {
          const premium = await this.adapter.premium(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount
          );
          assert.equal(premium.toString(), this.premium);
        });
      });

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
              this.optionType,
              this.purchaseAmount,
              {
                from: user,
                value: this.premium.sub(new BN("1")),
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
              this.optionType,
              this.purchaseAmount,
              {
                from: user,
                value: this.premium,
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
            "No matching underlying"
          );
        });

        it("creates options on hegic", async function () {
          const res = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount,
            {
              from: user,
              value: this.premium,
            }
          );

          expectEvent(res, "Purchased", {
            protocolName: web3.utils.sha3("HEGIC"),
            underlying: this.underlying,
            strikeAsset: this.strikeAsset,
            expiry: this.expiry.toString(),
            strikePrice: this.strikePrice,
            optionType: this.optionType.toString(),
            amount: this.purchaseAmount,
            premium: this.premium,
            optionID: this.expectedOptionID,
          });

          let hegicOptionsInstance;
          if (this.underlying == ETH_ADDRESS) {
            hegicOptionsInstance = this.hegicETHOptions;
          } else if (this.underlying == WBTC_ADDRESS) {
            hegicOptionsInstance = this.hegicWBTCOptions;
          } else {
            throw new Error(
              `Unsupported underlying asset found: ${underlying}`
            );
          }

          const {
            holder,
            strike,
            amount,
            lockedAmount,
            premium,
            expiration,
            optionType,
          } = await hegicOptionsInstance.options(this.expectedOptionID);

          const { settlementFee } = await hegicOptionsInstance.fees(
            this.expiry - this.startTime,
            this.purchaseAmount,
            this.strikePrice,
            this.optionType
          );
          assert.equal(holder, this.adapter.address);
          assert.equal(
            strike.toString(),
            this.strikePrice.div(new BN("10000000000"))
          );
          assert.equal(amount.toString(), this.purchaseAmount);
          assert.equal(lockedAmount.toString(), this.purchaseAmount);
          assert.equal(premium.toString(), this.premium.sub(settlementFee));
          assert.equal(expiration, this.expiry);
          assert.equal(optionType, this.optionType);
        });
      });

      describe("#exerciseProfit", () => {
        beforeEach(async function () {
          const snapShot = await helper.takeSnapshot();
          snapshotId = snapShot["result"];
        });

        afterEach(async () => {
          await helper.revertToSnapShot(snapshotId);
        });

        it("reverts when unknown options address passed", async function () {
          await expectRevert(
            this.adapter.exerciseProfit(constants.ZERO_ADDRESS, 0, 0),
            "optionsAddress must match either ETH or WBTC options"
          );
        });

        it("gets 0 profit for an out-the-money option", async function () {
          const otmPurchaseRes = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.otmStrikePrice,
            this.optionType,
            this.purchaseAmount,
            {
              from: user,
              value: this.premium,
            }
          );

          assert.equal(
            await this.adapter.exerciseProfit(
              this.hegicETHOptions.address,
              otmPurchaseRes.receipt.logs[0].args.optionID,
              0
            ),
            "0"
          );
        });

        it("gets profit for an in-the-money option", async function () {
          const itmPurchaseRes = await this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.itmStrikePrice,
            this.optionType,
            this.purchaseAmount,
            {
              from: user,
              value: this.premium,
            }
          );

          assert.equal(
            (
              await this.adapter.exerciseProfit(
                this.hegicETHOptions.address,
                itmPurchaseRes.receipt.logs[0].args.optionID,
                0
              )
            ).toString(),
            this.exerciseProfit
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
          await this.adapter.exercise(
            this.ethOptions.address,
            callOptionID,
            0,
            {
              from: user,
            }
          );
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

          assert.equal(
            (await userTracker.delta()).toString(),
            profit.toString()
          );
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

          assert.equal(
            (await userTracker.delta()).toString(),
            profit.toString()
          );
          assert.equal(
            (await hegicTracker.delta()).toString(),
            "-" + revenue.toString()
          );

          // make sure doji doesn't accidentally retain any ether
          assert.equal((await adapterTracker.delta()).toString(), "0");
        });
      });
    });
  }
});
