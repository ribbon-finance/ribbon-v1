const { accounts, contract } = require("@openzeppelin/test-environment");
const { assert } = require("chai");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { getDefaultArgs } = require("./utils.js");

const Instrument = contract.fromArtifact("DojimaInstrument");

describe("DojimaFactory", function () {
  const [admin, owner, user] = accounts;

  before(async function () {
    const {
      factory,
      colAsset,
      targetAsset,
      instrument,
      dToken,
      args,
      liquidatorProxy,
    } = await getDefaultArgs(admin, owner, user);

    this.factory = factory;
    this.collateralAsset = colAsset;
    this.targetAsset = targetAsset;
    this.contract = instrument;
    this.dToken = dToken;
    this.liquidatorProxy = liquidatorProxy;
    this.args = args;

    this.contractAddress = instrument.address;
    this.dTokenAddress = dToken.address;
  });

  it("initializes contract correctly", async function () {
    assert.equal(await this.contract.name(), this.args.name);
    assert.equal(await this.contract.symbol(), this.args.symbol);
    assert.equal((await this.contract.expiry()).toString(), this.args.expiry);
    assert.equal(
      (await this.contract.collateralizationRatio()).toString(),
      this.args.colRatio
    );
    assert.equal(
      await this.contract.collateralAsset(),
      this.collateralAsset.address
    );
    assert.equal(await this.contract.targetAsset(), this.targetAsset.address);
    assert.equal(await this.contract.expired(), false);
  });

  it("adds instrument to mapping", async function () {
    assert.equal(
      await this.factory.getInstrument(this.args.name),
      this.contract.address
    );
  });

  it("creates dToken correctly", async function () {
    assert.equal(await this.dToken.name(), this.args.name);
    assert.equal(await this.dToken.symbol(), this.args.symbol);
  });

  it("reverts if instrument already exists", async function () {
    const newContract = this.factory.newInstrument(
      this.args.name,
      this.args.symbol,
      this.args.expiry,
      this.args.colRatio,
      this.collateralAsset.address,
      this.targetAsset.address,
      this.liquidatorProxy.address,
      { from: owner }
    );

    expectRevert(newContract, "Instrument already exists");
  });

  it("emits event correctly", async function () {
    const name = "test";
    const res = await this.factory.newInstrument(
      name,
      "test",
      32503680000,
      1,
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
      { from: owner }
    );

    const instrument = await Instrument.at(res.logs[1].args.instrumentAddress);
    const dToken = await instrument.dToken();

    expectEvent(res, "InstrumentCreated", {
      name: name,
      instrumentAddress: instrument.address,
      dTokenAddress: dToken,
    });
  });
});
