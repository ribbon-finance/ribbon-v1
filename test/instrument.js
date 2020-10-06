const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils.js");

describe("Instrument", function () {
  const [owner, user, user2] = accounts;
  const supply = ether("1000000000000");

  before(async function () {
    const {
      factory,
      colAsset,
      targetAsset,
      instrument,
      dToken,
      args,
    } = await getDefaultArgs(owner, user);

    this.factory = factory;
    this.collateralAsset = colAsset;
    this.targetAsset = targetAsset;
    this.contract = instrument;
    this.dToken = dToken;
    this.args = args;

    await this.collateralAsset.approve(this.contract.address, supply, {
      from: user,
    });

    snapShotFresh = await helper.takeSnapshot();
    this.snapshotFresh = snapShotFresh["result"];
  });

  describe("#deposit", () => {
    before(async function () {
      await helper.revertToSnapShot(this.snapshotFresh);
    });

    it("emits event correctly", async function () {
      const amount = ether("1");
      const deposited = await this.contract.deposit(amount, {
        from: user,
      });

      expectEvent(deposited, "Deposited", {
        account: user,
        amount: amount,
      });
    });

    it("cannot deposit more than balance", async function () {
      await this.collateralAsset.approve(this.contract.address, supply, {
        from: user2,
      });
      await this.collateralAsset.transfer(user2, "1", { from: user });

      const deposited = this.contract.deposit("2", {
        from: user2,
      });

      expectRevert(deposited, "ERC20: transfer amount exceeds balance");
    });
  });

  describe("#mint", () => {
    before(async function () {
      await helper.revertToSnapShot(this.snapshotFresh);
    });

    it("mints correctly", async function () {
      const mintAmount = "1";
      await this.contract.mint(mintAmount, {
        from: user2,
      });
      assert.equal(await this.dToken.balanceOf(user2), mintAmount);
    });
  });
});
