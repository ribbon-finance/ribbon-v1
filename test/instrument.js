const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const helper = require("./utils.js");

const Factory = contract.fromArtifact("Factory");
const Instrument = contract.fromArtifact("Instrument");
const MockERC20 = contract.fromArtifact("MockERC20");
const DToken = contract.fromArtifact("DToken");

describe("Instrument", function () {
  const [owner, user, user2] = accounts;
  const supply = ether("1000000000000");
  const name = "ETH Future Expiry 12/25/20";
  const symbol = "dETH-1225";
  const expiry = "1608883200";
  const colRatio = ether("1.5");

  before(async function () {
    this.factory = await Factory.new();
    this.collateralAsset = await MockERC20.new(
      "Dai Stablecoin",
      "Dai",
      supply,
      {
        from: user,
      }
    );
    this.targetAsset = await MockERC20.new("Wrapped Bitcoin", "WBTC", supply, {
      from: user,
    });

    const result = await this.factory.newInstrument(
      name,
      symbol,
      expiry,
      colRatio,
      this.collateralAsset.address,
      this.targetAsset.address,
      { from: owner }
    );

    this.contract = await Instrument.at(result.logs[0].args.instrumentAddress);
    this.dToken = await DToken.at(await this.contract.dToken());

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
