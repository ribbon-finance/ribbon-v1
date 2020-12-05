const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");

const {
  ZERO_ADDRESS,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const { getDefaultArgs } = require("./utils.js");
const { encodeCall } = require("@openzeppelin/upgrades");

const Instrument = contract.fromArtifact("DojiVolatility");

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
const IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

describe("DojimaFactory", function () {
  const [admin, owner, user] = accounts;

  before(async function () {
    const { factory } = await getDefaultArgs(admin, owner, user);
    this.factory = factory;
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
});
