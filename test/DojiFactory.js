const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");

const {
  ZERO_ADDRESS,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const { getDefaultArgs } = require("./utils.js");
const { encodeCall } = require("@openzeppelin/upgrades");

const newInstrumentTypes = [
  "address",
  "address",
  "string",
  "string",
  "uint256",
  "uint256",
  "uint256",
  "address",
  "address",
  "address",
  "address",
  "address",
];
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

describe("DojiFactory", function () {
  const [admin, owner, user] = accounts;

  before(async function () {
    const { factory, hegicAdapter, opynV1Adapter } = await getDefaultArgs(
      admin,
      owner,
      user
    );
    this.factory = factory;
    this.hegicAdapter = hegicAdapter;
    this.opynV1Adapter = opynV1Adapter;
  });

  it("initializes factory correctly", async function () {
    assert.equal(await this.factory.owner(), owner);

    // check the storage for admin
    assert.equal(
      web3.utils.toChecksumAddress(
        await web3.eth.getStorageAt(this.factory.address, ADMIN_SLOT)
      ),
      admin
    );
    assert.equal(await this.factory.instrumentAdmin(), admin);
  });

  it("reverts if any account other than owner calls", async function () {
    const initData = encodeCall("initialize", newInstrumentTypes, [
      owner,
      "0x0000000000000000000000000000000000000000",
      "test",
      "test",
      "32503680000",
      "42000000000",
      "1",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000002",
    ]);

    const tx = this.factory.newInstrument(
      "0x0000000000000000000000000000000000000002",
      initData,
      { from: user }
    );
    await expectRevert(tx, "Only owner");
  });

  describe("#setAdapter", () => {
    it("sets the adapter", async function () {
      const res = await this.factory.setAdapter(
        "TEST",
        "0x0000000000000000000000000000000000000001",
        { from: owner }
      );

      expectEvent(res, "AdapterSet", {
        protocolName: web3.utils.sha3("TEST"),
        adapterAddress: "0x0000000000000000000000000000000000000001",
      });

      assert.equal(
        await this.factory.getAdapter("TEST"),
        "0x0000000000000000000000000000000000000001"
      );
      assert.equal((await this.factory.adapters).length, 3);
    });

    it("reverts when not owner", async function () {
      await expectRevert(
        this.factory.setAdapter(
          "TEST",
          "0x0000000000000000000000000000000000000001",
          { from: user }
        ),
        "Only owner"
      );
    });
  });

  describe("#getAdapter", () => {
    it("gets the hegic adapter", async function () {
      assert.equal(
        await this.factory.getAdapter("HEGIC"),
        this.hegicAdapter.address
      );
    });

    it("gets the opyn v1 adapter", async function () {
      assert.equal(
        await this.factory.getAdapter("OPYN_V1"),
        this.opynV1Adapter.address
      );
    });
  });

  describe("#adapters", () => {
    it("gets the adapters array", async function () {
      assert.equal(
        (await this.factory.adapters())[0],
        this.hegicAdapter.address
      );
      assert.equal(
        (await this.factory.adapters())[1],
        this.opynV1Adapter.address
      );
    });
  });
});
