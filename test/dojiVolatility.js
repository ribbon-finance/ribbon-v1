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
const DojimaVolatility = contract.fromArtifact("DojiVolatility");
const Factory = contract.fromArtifact("DojimaFactory");
const MockHegicETHOptions = contract.fromArtifact("MockHegicETHOptions");

describe("VolatilityStraddle", () => {
  const [admin, owner, user] = accounts;
  const settlementFeeRecipient = "0x0000000000000000000000000000000000000420";
  const pool = "0x0000000000000000000000000000000000000069";
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

  describe("#cost", () => {
    it("returns the total cost", async function () {
      const { totalCost, costOfCall, costOfPut } = await this.contract.cost(
        ether("1")
      );
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
      expectRevert(
        this.contract.buyInstrument(ether("1"), {
          from: user,
          value: ether("0.01"),
        }),
        "Value does not cover total cost"
      );
    });

    it("buys options on hegic", async function () {
      const { costOfCall, costOfPut } = await this.contract.cost(ether("1"));

      const res = await this.contract.buyInstrument(ether("1"), {
        from: user,
        value: ether("0.05735"),
      });

      expectEvent(res, "PositionCreated", {
        account: user,
        positionID: "0",
        callOptionPosition: [
          "2",
          ether("1").toString(),
          web3.eth.abi.encodeParameters(["uint256"], ["0"]),
        ],
        putOptionPosition: [
          "2",
          ether("1").toString(),
          web3.eth.abi.encodeParameters(["uint256"], ["1"]),
        ],
        costOfCall,
        costOfPut,
      });

      const index = await this.contract.positionIndex(user);
      assert.equal(index, 1);

      const {
        callPosition,
        putPosition,
      } = await this.contract.instrumentPositions(user, 0);

      assert.equal(callPosition.protocol, "2");
      assert.equal(callPosition.amount, ether("1"));
      assert.equal(
        callPosition.metadata,
        web3.eth.abi.encodeParameters(["uint256"], ["0"])
      );

      assert.equal(putPosition.protocol, "2");
      assert.equal(putPosition.amount, ether("1"));
      assert.equal(
        putPosition.metadata,
        web3.eth.abi.encodeParameters(["uint256"], ["1"])
      );
    });
  });

  describe("#deposit", () => {
    it("raises not implemented exception", async function () {
      expectRevert(this.contract.deposit(1, { from: user }), "Not implemented");
    });
  });

  describe("#mint", () => {
    it("raises not implemented exception", async function () {
      expectRevert(this.contract.mint(1, { from: user }), "Not implemented");
    });
  });

  describe("#depositAndMint", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.depositAndMint(1, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#depositMintAndSell", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.depositMintAndSell(1, 1, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#settle", () => {
    it("raises not implemented exception", async function () {
      expectRevert(this.contract.settle({ from: user }), "Not implemented");
    });
  });

  describe("#repayDebt", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.repayDebt(constants.ZERO_ADDRESS, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("#withdrawAfterExpiry", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.withdrawAfterExpiry({ from: user }),
        "Not implemented"
      );
    });
  });
});
