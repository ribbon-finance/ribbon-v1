const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils.js");

const MockDataProvider = contract.fromArtifact("MockDataProvider");

describe("Instrument", function () {
  const [admin, owner, user, user2] = accounts;
  const supply = ether("1000000000000");

  before(async function () {
    const {
      factory,
      colAsset,
      targetAsset,
      instrument,
      dToken,
      args,
    } = await getDefaultArgs(admin, owner, user);

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
    snapshotFreshId = snapShotFresh["result"];
  });

  describe("#deposit", () => {
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
      await helper.revertToSnapShot(snapshotFreshId);

      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      // Set Price of ETH/ETH to 1
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });
      // Set Price of DAI/ETH to 0.002983
      await dataProvider.setPrice(
        this.collateralAsset.address,
        ether("0.002983"),
        { from: owner }
      );
    });

    it("mints correctly and emits event", async function () {
      // Deposit 500 Dai
      const amount = ether("500");
      await this.contract.deposit(amount, { from: user });

      // Mint 1 dETH
      const mintAmount = ether("1");
      const minted = await this.contract.mint(mintAmount, { from: user });

      expectEvent(minted, "Minted", {
        account: user,
        amount: mintAmount,
      });

      res = await this.contract.getVault(user);
      assert.equal(res._collateral.toString(), amount);
      assert.equal(res._dTokenDebt.toString(), mintAmount);
    });

    it("reverts if mint value too high", async function () {
      const mintAmount = ether("100");
      const minted = this.contract.mint(mintAmount, { from: user });
      expectRevert(minted, "Collateralization ratio too low to mint");
    });
  });

  describe("#depositAndMint", () => {
    it("deposits and mints correctly", async function () {
      vault = await this.contract.getVault(user);
      const startCol = vault._collateral;
      const startDebt = vault._dTokenDebt;
      // Deposit 500 Dai
      const amount = ether("500");
      // Mint 1 dETH
      const mintAmount = ether("1");
      const res = await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });

      expectEvent(res, "Deposited", {
        account: user,
        amount: amount,
      });

      expectEvent(res, "Minted", {
        account: user,
        amount: mintAmount,
      });

      vault = await this.contract.getVault(user);
      assert.equal(vault._collateral.toString(), startCol.add(amount));
      assert.equal(vault._dTokenDebt.toString(), startDebt.add(mintAmount));
    });
  });
});
