const { accounts, contract } = require("@openzeppelin/test-environment");
const { assert } = require("chai");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { getDefaultArgs } = require("./utils.js");
const { encodeCall } = require("@openzeppelin/upgrades");

const Instrument = contract.fromArtifact("DualCurrency");

const newInstrumentTypes = [
  "address",
  "string",
  "string",
  "uint256",
  "uint256",
  "address",
  "address",
  "address",
];

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
      dataProvider,
      instrumentLogic,
    } = await getDefaultArgs(admin, owner, user);

    this.factory = factory;
    this.collateralAsset = colAsset;
    this.targetAsset = targetAsset;
    this.contract = instrument;
    this.dToken = dToken;
    this.liquidatorProxy = liquidatorProxy;
    this.dataProvider = dataProvider;
    this.instrumentLogic = instrumentLogic;
    this.args = args;

    this.contractAddress = instrument.address;
    this.dTokenAddress = dToken.address;
  });

  it("initializes factory correctly", async function () {
    assert.equal(
      await this.factory.liquidatorProxy(),
      this.liquidatorProxy.address
    );
    assert.equal(await this.factory.dataProvider(), this.dataProvider.address);
    assert.equal(await this.factory.owner(), owner);
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
    const initData = encodeCall("initialize", newInstrumentTypes, [
      this.dataProvider.address,
      this.args.name,
      this.args.symbol,
      this.args.expiry.toString(),
      this.args.colRatio.toString(),
      this.collateralAsset.address,
      this.targetAsset.address,
      this.liquidatorProxy.address,
    ]);

    const newContract = this.factory.newInstrument(
      this.instrumentLogic.address,
      initData,
      { from: owner }
    );

    expectRevert(newContract, "Instrument already exists");
  });

  it("reverts if any account other than owner calls", async function () {
    const initData = encodeCall("initialize", newInstrumentTypes, [
      this.dataProvider.address,
      "test",
      "test",
      "32503680000",
      "1",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000001",
      this.liquidatorProxy.address,
    ]);

    const tx = this.factory.newInstrument(
      this.instrumentLogic.address,
      initData,
      { from: user }
    );
    await expectRevert(tx, "Only owner");
  });

  it("emits event correctly", async function () {
    const name = "test";

    const initData = encodeCall("initialize", newInstrumentTypes, [
      this.dataProvider.address,
      name,
      "test",
      "32503680000",
      "1",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000001",
      this.liquidatorProxy.address,
    ]);

    const res = await this.factory.newInstrument(
      this.instrumentLogic.address,
      initData,
      { from: owner }
    );

    const instrument = await Instrument.at(res.logs[1].args.instrumentAddress);
    const dToken = await instrument.dToken();

    expectEvent(res, "ProxyCreated", {
      logic: this.instrumentLogic.address,
      proxyAddress: instrument.address,
    });

    expectEvent(res, "InstrumentCreated", {
      name: name,
      instrumentAddress: instrument.address,
      dTokenAddress: dToken,
    });
  });
});
