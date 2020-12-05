const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
  ether,
  constants,
  time,
  expectRevert,
  expectEvent,
} = require("@openzeppelin/test-helpers");
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

  before(async function () {
    const mintAmount = ether("1000");
    const WBTC = await MockERC20.new("Wrapped Bitcoin", "WBTC", mintAmount, {
      from: owner,
    });
    const ethOptions = await MockHegicETHOptions.new(
      pool,
      settlementFeeRecipient,
      { from: admin }
    );
    const wbtcOptions = await MockHegicWBTCOptions.new(
      pool,
      settlementFeeRecipient,
      { from: admin }
    );

    this.adapter = await HegicAdapter.new(
      ethOptions.address,
      wbtcOptions.address,
      ETH_ADDRESS,
      WBTC.address
    );

    this.underlying = ETH_ADDRESS;
    this.strikeAsset = constants.ZERO_ADDRESS;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    this.expiry = Math.floor(expiryDate.getTime() / 1000);
    this.startTime = Math.floor(Date.now() / 1000);
    this.strikePrice = ether("500");

    // test cases
    this.protocolName = "HEGIC";
    this.nonFungible = true;

    // premium
    this.callPremium = ether("0.028675");
    this.putPremium = ether("0.028675");

    await ethOptions.setCurrentPrice(ether("500"));
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

    it("buys call options on hegic", async function () {
      const premium = await this.adapter.premium(
        this.underlying,
        this.strikeAsset,
        this.expiry,
        this.strikePrice,
        CALL_OPTION_TYPE,
        ether("1")
      );

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

      expectEvent(res, "Purchased", {});
    });

    // it("buys options on hegic", async function () {
    //   const { costOfCall, costOfPut } = await this.adapter.premium(ether("1"));

    //   const res = await this.adapter.purchase(ether("1"), {
    //     from: user,
    //     value: ether("0.05735"),
    //   });

    //   expectEvent(res, "PositionCreated", {
    //     account: user,
    //     positionID: "0",
    //     costOfCall,
    //     costOfPut,
    //     callOptionProtocol: "2",
    //     putOptionProtocol: "2",
    //     callOptionAmount: ether("1"),
    //     putOptionAmount: ether("1"),
    //     callOptionID: "0",
    //     putOptionID: "1",
    //   });

    //   const position = await this.contract.instrumentPositions(user, 0);

    //   assert.equal(position.callProtocol, "2");
    //   assert.equal(position.callAmount.toString(), ether("1"));
    //   assert.equal(position.callOptionID, "0");
    //   assert.equal(position.putProtocol, "2");
    //   assert.equal(position.putAmount.toString(), ether("1"));
    //   assert.equal(position.putOptionID, "1");
    // });

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

  // describe("#exerciseProfit", () => {
  //   let positionID;

  //   beforeEach(async function () {
  //     const snapShot = await helper.takeSnapshot();
  //     snapshotId = snapShot["result"];

  //     const res = await this.adapter.buyInstrument(ether("1"), {
  //       from: user,
  //       value: ether("0.05735"),
  //     });
  //     positionID = res.receipt.logs[0].args.positionID;
  //   });

  //   afterEach(async () => {
  //     await helper.revertToSnapShot(snapshotId);
  //   });

  //   it("calculates the profit for exercising a call option", async function () {
  //     const { callOptionID } = await this.contract.instrumentPositions(
  //       user,
  //       positionID
  //     );

  //     // should be zero if price == strike
  //     assert.equal(await this.contract.exerciseProfit(callOptionID), "0");

  //     // should be zero if price < strike

  //     await setToProfitableCallPrice();

  //     await this.hegicOptions.setCurrentPrice(ether("490"));
  //     assert.equal(await this.contract.exerciseProfit(callOptionID), "0");

  //     // should be positive if price > strike
  //     await this.hegicOptions.exerciseProfit(ether("550"));

  //     assert.equal(
  //       (await this.contract.exerciseProfit(callOptionID)).toString(),
  //       ether("0.090909090909090909")
  //     );
  //   });
  // });
});
