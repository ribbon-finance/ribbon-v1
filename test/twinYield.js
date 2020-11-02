const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  BN,
  time,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils.js");

const MockDataProvider = contract.fromArtifact("MockDataProvider");

describe("TwinYield", function () {
  const [admin, owner, user, user2, user3] = accounts;
  const supply = ether("1000000000000");
  const transferAmount = ether("100000000");
  let self, snapshotId;

  before(async function () {
    const {
      factory,
      colAsset,
      targetAsset,
      instrument,
      dToken,
      args,
    } = await getDefaultArgs(admin, owner, user);

    self = this;
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
  });

  describe("#deposit", () => {
    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("emits event correctly", async function () {
      const amount = ether("1");
      const deposited = await this.contract.deposit(amount, {
        from: user,
      });

      await expectEvent(deposited, "Deposited", {
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

      await expectRevert(deposited, "ERC20: transfer amount exceeds balance");
    });
  });

  describe("#mint", () => {
    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("mints correctly and emits event", async function () {
      const amount = ether("1");
      await this.contract.deposit(amount, { from: user });

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
      await expectRevert(minted, "Cannot mint more than col");
    });
  });

  describe("#depositAndMint", () => {
    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("deposits and mints correctly", async function () {
      vault = await this.contract.getVault(user);
      const startCol = vault._collateral;
      const startDebt = vault._dTokenDebt;

      const amount = ether("1");
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
    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

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
        repayer: user2,
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

      await expectRevert(repay, "Cannot repay more debt than exists");
    });

    it("cannot repay debt for other vaults", async function () {
      const amount = ether("1");
      const mintAmount = "1";
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });

      const repay = this.contract.repayDebt(user2, mintAmount, {
        from: user,
      });

      await expectRevert(repay, "Only vault owner can repay debt");
    });

    it("cannot repay debt if account has insufficient dtokens", async function () {
      const amount = ether("1");
      const mintAmount = "1";

      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });

      // transfer whole balance away
      const bal = await this.dToken.balanceOf(user2);
      await this.dToken.transfer(owner, bal, { from: user2 });

      const repay = this.contract.repayDebt(user2, "1", {
        from: user2,
      });

      await expectRevert(repay, "Cannot burn more than account balance");
    });
  });

  describe("#settle", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );

      // Set Price of ETH/USD to $420
      await dataProvider.setPrice(this.collateralAsset.address, "42000000000", {
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
      await expectRevert(res, "Instrument has not expired");
    });

    it("works if instrument is expired, and emits correct events", async function () {
      const settlePrice = "42000000000"
      const expiryTimestamp = parseInt(this.args.expiry);
      const newTimestamp = 1 + expiryTimestamp;
      time.increaseTo(newTimestamp);

      const settled = await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      expectEvent(settled, "Settled", {
        settlePrice: settlePrice,
      });

      // As long as the block.timestamp is after the defined expiry, it is valid
      const blockTimestamp = settled.logs[0].args.timestamp.toNumber();
      assert.isAtLeast(blockTimestamp, expiryTimestamp);

      assert.equal(
        (await this.contract.settlePrice()).toString(),
        settlePrice
      );
    });

    it("cannot mint, deposit, or withdrawCol after settled", async function () {
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      const settled = await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      const deposited = this.contract.deposit("1", {
        from: user,
      });
      await expectRevert(deposited, "Instrument must not be expired");

      const mint = this.contract.mint("1", {
        from: user,
      });
      await expectRevert(mint, "Instrument must not be expired");

      const depositAndMint = this.contract.depositAndMint("1", "1", {
        from: user,
      });
      await expectRevert(depositAndMint, "Instrument must not be expired");
    });
  });


  describe("#redeem", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.collateralAsset.address, "30000000000", {
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

    it("redeems correct amount for settle < strike", async function () {
      const amount = ether("1");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      const startCol = await this.collateralAsset.balanceOf(user);
      const startD = await this.dToken.balanceOf(user);
      const startColContract = await this.collateralAsset.balanceOf(
        this.contract.address
      );

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });

      const redeem = await this.contract.redeem(mintAmount, { from: user });

      const endCol = await this.collateralAsset.balanceOf(user);
      const endD = await this.dToken.balanceOf(user);
      const endColContract = await this.collateralAsset.balanceOf(
        this.contract.address
      );

      // Account ends with more collateral
      assert.equal(endCol.sub(startCol).toString(), mintAmount);
      // Account ends with less dTokens
      assert.equal(startD.sub(endD).toString(), mintAmount);
      // Contract ends with less collateral
      assert.equal(startColContract.sub(endColContract).toString(), mintAmount);

      expectEvent(redeem, "Redeemed", {
        account: user,
        dTokenAmount: mintAmount,
        collateralAmount: mintAmount,
      });
    });

    it("redeems correct amounts for different prices", async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.collateralAsset.address, "50000000000", {
        from: owner,
      });

      const amount = ether("1");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });

      const redeem = await this.contract.redeem(mintAmount, { from: user });

      expectEvent(redeem, "Redeemed", {
        account: user,
        dTokenAmount: mintAmount,
        collateralAmount: ether("0.8"),
      });
    });

    it("other accounts can redeem", async function () {
      const amount = ether("1");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      await this.dToken.transfer(user2, mintAmount, { from: user });

      const startCol = await this.collateralAsset.balanceOf(user2);
      const startD = await this.dToken.balanceOf(user2);

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });

      const redeem = await this.contract.redeem(mintAmount, { from: user2 });

      const endCol = await this.collateralAsset.balanceOf(user2);
      const endD = await this.dToken.balanceOf(user2);

      assert.equal(endCol.sub(startCol).toString(), mintAmount);
      assert.equal(startD.sub(endD).toString(), mintAmount);

      expectEvent(redeem, "Redeemed", {
        account: user2,
        dTokenAmount: mintAmount,
        collateralAmount: mintAmount,
      });
    });

    it("cannot redeem if not expired", async function () {
      const amount = ether("1");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      const redeem = this.contract.redeem(mintAmount, { from: user2 });
      await expectRevert(redeem, "Instrument must be expired");
    });

    it("cannot redeem more than account owns", async function () {
      const amount = ether("1");
      const mintAmount = ether("1");
      const redeemAmount = ether("1.5");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });

      const redeem = this.contract.redeem(redeemAmount, { from: user });
      await expectRevert(redeem, "Cannot burn more than account balance.");
    });
  });

  describe("#getColPrice and #getTargetPrice", () => {
    const targetPrice = ether("123");
    const colPrice = ether("234");

    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.targetAsset.address, targetPrice, {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, colPrice, {
        from: owner,
      });
    });

    it("returns correct price", async function () {
      res = await this.contract.getColPrice();
      assert.equal(res.toString(), colPrice);

      res = await this.contract.getTargetPrice();
      assert.equal(res.toString(), targetPrice);
    });
  });

  describe("#withdrawAfterExpiry", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.collateralAsset.address, "30000000000", {
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

    it("withdraws 0 if settle < strike", async function () {
      const amount = ether("1");
      const mintAmount = ether("1");

      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      res = await this.contract.getVault(user);
      const startBalance = await this.collateralAsset.balanceOf(user);
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      const withdrawCol = await this.contract.withdrawAfterExpiry({
        from: user,
      });
      const endBalance = await this.collateralAsset.balanceOf(user);
      assert.equal(endBalance.toString(), startBalance.toString());

      expectEvent(withdrawCol, "WithdrewExpired", {
        account: user,
        amount: "0",
      });
    });

    it("withdraws correctly if settle > strike", async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.collateralAsset.address, "50000000000", {
        from: owner,
      });

      const amount = ether("1");
      const mintAmount = ether("1");
      const expectedWithdrawAmount = ether("0.2");

      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      res = await this.contract.getVault(user);
      const startBalance = await this.collateralAsset.balanceOf(user);
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      const withdrawCol = await this.contract.withdrawAfterExpiry({
        from: user,
      });
      const endBalance = await this.collateralAsset.balanceOf(user);
      assert.equal(endBalance.sub(startBalance).toString(), expectedWithdrawAmount);

      expectEvent(withdrawCol, "WithdrewExpired", {
        account: user,
        amount: expectedWithdrawAmount,
      });
    });

    it("withdraw at settleprice even if oracle changes", async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.collateralAsset.address, "50000000000", {
        from: owner,
      });

      const amount = ether("1");
      const mintAmount = ether("1");
      const expectedWithdrawAmount = ether("0.2");

      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      res = await this.contract.getVault(user);
      const startBalance = await this.collateralAsset.balanceOf(user);
      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });
      // Change price after settle 
      await dataProvider.setPrice(this.collateralAsset.address, "30000000000", {
        from: owner,
      });

      assert.equal(await this.contract.expired(), true);

      const withdrawCol = await this.contract.withdrawAfterExpiry({
        from: user,
      });
      const endBalance = await this.collateralAsset.balanceOf(user);
      assert.equal(endBalance.sub(startBalance).toString(), expectedWithdrawAmount);

      expectEvent(withdrawCol, "WithdrewExpired", {
        account: user,
        amount: expectedWithdrawAmount,
      });
    });

    it("reverts if not expired", async function () {
      const amount = ether("1");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });

      const withdrawCol = this.contract.withdrawAfterExpiry({
        from: user,
      });

      await expectRevert(withdrawCol, "Instrument must be expired");
    });
  });
});
