const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  time,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils.js");

const MockDataProvider = contract.fromArtifact("MockDataProvider");

describe("Instrument", function () {
  const [admin, owner, user, user2, user3] = accounts;
  const supply = ether("1000000000000");
  const transferAmount = ether("100000000");

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

    await this.collateralAsset.transfer(user2, transferAmount, { from: user });
    await this.collateralAsset.approve(this.contract.address, supply, {
      from: user2,
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
        from: user3,
      });
      await this.collateralAsset.transfer(user2, "1", { from: user });

      const deposited = this.contract.deposit("2", {
        from: user3,
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
      const minted = this.contract.mint(ether("100"), { from: user });
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

  describe("#repayDebt", () => {
    it("repays debt correctly for own vault", async function () {
      const amount = ether("1");
      const mintAmount = "1";
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });

      const startBalance = await this.dToken.balanceOf(user2);
      vault = await this.contract.getVault(user2);
      const startDebt = vault._dTokenDebt;

      const repay = await this.contract.repayDebt(user2, mintAmount, {
        from: user2,
      });
      const endBalance = await this.dToken.balanceOf(user2);

      vault = await this.contract.getVault(user2);
      // Correct debt in vault
      assert.equal(
        vault._dTokenDebt.toString(),
        startDebt - parseInt(mintAmount)
      );

      // DToken balance reduces
      assert.equal((startBalance - endBalance).toString(), mintAmount);

      expectEvent(repay, "Repaid", {
        account: user2,
        vault: user2,
        amount: mintAmount,
      });
    });

    it("revert if trying to repay more debt than exists", async function () {
      vault = await this.contract.getVault(user2);
      const startDebt = vault._dTokenDebt;

      const repay = this.contract.repayDebt(user2, startDebt + 1, {
        from: user2,
      });

      expectRevert(repay, "Cannot repay more debt than exists in the vault");
    });

    it("can repay debt for other vaults", async function () {
      const amount = ether("1");
      const mintAmount = "1";
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });

      const repay = await this.contract.repayDebt(user2, mintAmount, {
        from: user,
      });

      expectEvent(repay, "Repaid", {
        account: user,
        vault: user2,
        amount: mintAmount,
      });
    });

    it("cannot repay debt if account has insufficient dtokens", async function () {
      const amount = ether("1");
      const mintAmount = "1";
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });
      const repay = this.contract.repayDebt(user2, "1", {
        from: owner,
      });

      expectRevert(repay, "Cannot burn more than account balance");
    });
  });

  describe("#settle", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      // Set Price of ETH/ETH to 1
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });
      // Set Price of DAI/ETH to 0.01
      await dataProvider.setPrice(this.collateralAsset.address, ether("0.01"), {
        from: owner,
      });
    });

    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("fails if not expired", async function () {
      const res = this.contract.settle({ from: user });
      expectRevert(res, "Instrument has not expired");
    });

    it("works if instrument is expired, and emits correct events", async function () {
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      const settled = await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      expectEvent(settled, "Settled", {
        timestamp: newTimestamp.toString(),
        settlePrice: ether("100"),
        targetAssetPrice: ether("1"),
        collateralAssetPrice: ether("0.01"),
      });

      assert.equal(
        (await this.contract.settlePrice()).toString(),
        ether("100")
      );
    });

    it("works with different prices", async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );

      await dataProvider.setPrice(this.targetAsset.address, ether("0.01"), {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, ether("1"), {
        from: owner,
      });

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      const settled = await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      expectEvent(settled, "Settled", {
        timestamp: newTimestamp.toString(),
        settlePrice: ether("0.01"),
        targetAssetPrice: ether("0.01"),
        collateralAssetPrice: ether("1"),
      });
    });

    it("cannot mint and deposit after settled", async function () {
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      const settled = await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      const deposited = this.contract.deposit("1", {
        from: user,
      });
      expectRevert(deposited, "Instrument must not be expired");

      const mint = this.contract.mint("1", {
        from: user,
      });
      expectRevert(mint, "Instrument must not be expired");

      const depositAndMint = this.contract.depositAndMint("1", "1", {
        from: user,
      });
      expectRevert(depositAndMint, "Instrument must not be expired");
    });
  });
});
