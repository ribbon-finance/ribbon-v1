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

describe("VolatilityStraddle", () => {
  const [admin, owner, user] = accounts;
  let self;

  before(async function () {
    self = this;
    this.hegicOptionAddress = constants.ZERO_ADDRESS;
    this.name = "VOL 500 25/12/2020";
    this.symbol = "VOL-500-251220";
    this.expiry = "32503680000";
    this.strikePrice = "500000000000000000000";

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
      this.strikePrice,
      this.hegicOptionAddress,
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
  });

  describe("deposit", () => {
    it("raises not implemented exception", async function () {
      expectRevert(this.contract.deposit(1, { from: user }), "Not implemented");
    });
  });

  describe("mint", () => {
    it("raises not implemented exception", async function () {
      expectRevert(this.contract.mint(1, { from: user }), "Not implemented");
    });
  });

  describe("depositAndMint", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.depositAndMint(1, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("depositMintAndSell", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.depositMintAndSell(1, 1, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("settle", () => {
    it("raises not implemented exception", async function () {
      expectRevert(this.contract.settle({ from: user }), "Not implemented");
    });
  });

  describe("repayDebt", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.repayDebt(constants.ZERO_ADDRESS, 1, { from: user }),
        "Not implemented"
      );
    });
  });

  describe("withdrawAfterExpiry", () => {
    it("raises not implemented exception", async function () {
      expectRevert(
        this.contract.withdrawAfterExpiry({ from: user }),
        "Not implemented"
      );
    });
  });
});
