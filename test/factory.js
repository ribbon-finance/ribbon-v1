const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");

const {
  ether,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");

const Factory = contract.fromArtifact("Factory");
const Instrument = contract.fromArtifact("Instrument");
const DToken = contract.fromArtifact("DToken");

describe("Factory", function () {
  const [owner] = accounts;
  const name = "ETH Future Expiry 12/25/20";
  const symbol = "dETH-1225";
  const expiry = "1608883200";
  const colRatio = ether("1.5");
  const collateralAsset = "0x0000000000000000000000000000000000000000";
  const targetAsset = "0x0000000000000000000000000000000000000001";

  before(async function () {
    this.factory = await Factory.new();
    this.result = await this.factory.newInstrument(
      name,
      symbol,
      expiry,
      colRatio,
      collateralAsset,
      targetAsset,
      { from: owner }
    );

    this.contractAddress = this.result.logs[0].args.instrumentAddress;
    this.dTokenAddress = this.result.logs[0].args.dTokenAddress;
  });

  it("initializes contract correctly", async function () {
    const contract = await Instrument.at(this.contractAddress);

    assert.equal(await contract.name(), name);
    assert.equal(await contract.symbol(), symbol);
    assert.equal((await contract.expiry()).toString(), expiry);
    assert.equal(
      (await contract.collateralizationRatio()).toString(),
      colRatio
    );
    assert.equal(await contract.collateralAsset(), collateralAsset);
    assert.equal(await contract.targetAsset(), targetAsset);
  });

  it("emits event correctly", async function () {
    expectEvent(this.result, "InstrumentCreated", {
      name: name,
      instrumentAddress: this.contractAddress,
      dTokenAddress: this.dTokenAddress,
    });
  });

  it("adds instrument to mapping", async function () {
    assert.equal(await this.factory.getInstrument(name), this.contractAddress);
  });

  it("reverts if instrument already exists", async function () {
    const newContract = this.factory.newInstrument(
      name,
      symbol,
      expiry,
      colRatio,
      collateralAsset,
      targetAsset,
      { from: owner }
    );

    expectRevert(newContract, "Instrument already exists");
  });

  it("creates dToken correctly", async function () {
    const contract = await DToken.at(this.dTokenAddress);
    assert.equal(await contract.name(), name);
    assert.equal(await contract.symbol(), symbol);
  });
});
