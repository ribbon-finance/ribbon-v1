const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils.js");

describe("DToken", function () {
  const [admin, owner, user] = accounts;

  before(async function () {
    const { instrument, dToken } = await getDefaultArgs(admin, owner, user);
    this.contract = instrument;
    this.dToken = dToken;
    snapShotFresh = await helper.takeSnapshot();
    snapshotFreshId = snapShotFresh["result"];
  });

  describe("#owner", () => {
    it("returns the instrument as the owner", async function () {
      assert.equal(await this.dToken.owner(), this.contract.address);
    });
  });

  describe("#dojimaInstrument", () => {
    it("returns the instrument", async function () {
      assert.equal(await this.dToken.dojimaInstrument(), this.contract.address);
    });
  });
});
