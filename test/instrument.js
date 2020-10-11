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

describe("DojimaInstrument", function () {
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
    before(async function () {
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

    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
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

    it("increments totalDebt", async function () {
      const startTotalDebt = await this.contract.totalDebt();
      // Deposit 500 Dai
      const amount = ether("500");
      await this.contract.deposit(amount, { from: user });

      // Mint 1 dETH
      const mintAmount = ether("1");
      await this.contract.mint(mintAmount, { from: user });

      const endTotalDebt = await this.contract.totalDebt();
      assert.equal(endTotalDebt.sub(startTotalDebt).toString(), mintAmount);
    });

    it("reverts if mint value too high", async function () {
      const minted = this.contract.mint(ether("100"), { from: user });
      await expectRevert(minted, "Collateralization ratio too low");
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

    it("decrements totalDebt", async function () {
      const amount = ether("1");
      const mintAmount = "1";
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });
      const startTotalDebt = await this.contract.totalDebt();

      await this.contract.repayDebt(user2, mintAmount, {
        from: user2,
      });

      const endTotalDebt = await this.contract.totalDebt();
      assert.equal(startTotalDebt.sub(endTotalDebt).toString(), mintAmount);
    });

    it("revert if trying to repay more debt than exists", async function () {
      vault = await this.contract.getVault(user2);
      const startDebt = vault._dTokenDebt;

      const repay = this.contract.repayDebt(user2, startDebt + 1, {
        from: user2,
      });

      await expectRevert(repay, "Cannot repay more debt than exists");
    });

    it("cannot repay debt for other vaults if not liquidator proxy", async function () {
      const amount = ether("1");
      const mintAmount = "1";
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });

      const repay = this.contract.repayDebt(user2, mintAmount, {
        from: user,
      });

      await expectRevert(repay, "Only liquidatorProxy");
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
      await expectRevert(res, "Instrument has not expired");
    });

    it("works if instrument is expired, and emits correct events", async function () {
      const expiryTimestamp = parseInt(this.args.expiry);
      const newTimestamp = 1 + expiryTimestamp;
      time.increaseTo(newTimestamp);

      const settled = await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      expectEvent(settled, "Settled", {
        settlePrice: ether("100"),
        targetAssetPrice: ether("1"),
        collateralAssetPrice: ether("0.01"),
      });

      // As long as the block.timestamp is after the defined expiry, it is valid
      const blockTimestamp = settled.logs[0].args.timestamp.toNumber();
      assert.isAtLeast(blockTimestamp, expiryTimestamp);

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

      const withdrawCol = this.contract.withdrawCollateral("1", {
        from: user,
      });
      await expectRevert(withdrawCol, "Instrument must not be expired");
    });
  });

  describe("#withdrawCollateralExpired", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, ether("1"), {
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

    it("withdraws correctly after expiry", async function () {
      const amount = ether("2");
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

      const withdrawCol = await this.contract.withdrawCollateralExpired({
        from: user,
      });
      const endBalance = await this.collateralAsset.balanceOf(user);
      assert.equal(endBalance.sub(startBalance).toString(), mintAmount);

      expectEvent(withdrawCol, "WithdrewExpired", {
        account: user,
        amount: mintAmount,
      });
    });

    it("withdraws correctly different prices", async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, ether("400"), {
        from: owner,
      });

      const amount = ether("1");
      const mintAmount = ether("200");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      const withdrawCol = await this.contract.withdrawCollateralExpired({
        from: user,
      });

      expectEvent(withdrawCol, "WithdrewExpired", {
        account: user,
        amount: ether("0.5"),
      });
    });

    it("withdraw at settleprice even if oracle changes", async function () {
      const amount = ether("2");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      const startBalance = await this.collateralAsset.balanceOf(user);

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });
      assert.equal(await this.contract.expired(), true);

      // Change prices after expiry
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.targetAsset.address, ether("100"), {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, ether("50"), {
        from: owner,
      });

      await this.contract.withdrawCollateralExpired({
        from: user,
      });
      const endBalance = await this.collateralAsset.balanceOf(user);

      assert.equal(endBalance.sub(startBalance).toString(), mintAmount);
      res = await this.contract.getVault(user);
      assert.equal(res._collateral.toString(), mintAmount);
      assert.equal(res._dTokenDebt.toString(), mintAmount);
    });

    it("reverts if not expired", async function () {
      const amount = ether("2");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });

      const withdrawCol = this.contract.withdrawCollateralExpired({
        from: user,
      });

      await expectRevert(withdrawCol, "Instrument must be expired");
    });
  });

  describe("#redeem", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, ether("1"), {
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

    it("redeems correct amount", async function () {
      const amount = ether("2");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      const startTotalDebt = await this.contract.totalDebt();
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

      const endTotalDebt = await this.contract.totalDebt();
      assert.equal(startTotalDebt.sub(endTotalDebt).toString(), mintAmount);
    });

    it("redeems correct amounts for different prices", async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(
        this.collateralAsset.address,
        ether("0.002"),
        {
          from: owner,
        }
      );
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });

      const amount = ether("1000");
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
        collateralAmount: ether("500"),
      });
    });

    it("other accounts can redeem", async function () {
      const amount = ether("2");
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
      const amount = ether("2");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      const redeem = this.contract.redeem(mintAmount, { from: user2 });
      await expectRevert(redeem, "Instrument must be expired");
    });

    it("cannot redeem more than account owns", async function () {
      const amount = ether("2");
      const mintAmount = ether("1");
      const redeemAmount = ether("1.5");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user2,
      });

      const newTimestamp = 1 + parseInt(this.args.expiry);
      time.increaseTo(newTimestamp);

      await this.contract.settle({ from: user });

      const redeem = this.contract.redeem(redeemAmount, { from: user });
      await expectRevert(redeem, "Cannot burn more than account balance.");
    });
  });

  describe("#getNewColRatio", () => {
    before(async function () {
      const dataProvider = await MockDataProvider.at(
        await this.contract.dataProvider()
      );
      await dataProvider.setPrice(this.targetAsset.address, ether("1"), {
        from: owner,
      });
      await dataProvider.setPrice(this.collateralAsset.address, ether("1"), {
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

    it("returns correct col ratio", async function () {
      const amount = ether("2");
      const mintAmount = ether("1");
      await this.contract.depositAndMint(amount, mintAmount, {
        from: user,
      });
      var res = await this.contract.getNewColRatio(
        user,
        ether("1"),
        true,
        "0",
        false
      );
      assert.equal(res.toString(), ether("3"));

      res = await this.contract.getNewColRatio(
        user,
        ether("1"),
        false,
        "0",
        false
      );
      assert.equal(res.toString(), ether("1"));

      res = await this.contract.getNewColRatio(
        user,
        "0",
        false,
        ether("1"),
        true
      );
      assert.equal(res.toString(), ether("1"));

      res = await this.contract.getNewColRatio(
        user,
        "0",
        false,
        ether("0.5"),
        false
      );
      assert.equal(res.toString(), ether("4"));
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

  describe("#liquidateFromVault", () => {
    it("will revert if caller is not liquidator proxy", async function () {
      const tx = this.contract.liquidateFromVault(
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000001",
        ether("100"),
        ether("1.05")
      );
      await expectRevert(tx, "Only liquidatorProxy");
    });
  });

  describe("#vaultCollateralizationRatio", () => {
    it("will return max(uint256) when there is no debt", async function () {
      assert.equal(
        (
          await this.contract.vaultCollateralizationRatio(
            constants.ZERO_ADDRESS
          )
        ).toString(),
        new BN(
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          16
        )
      );
    });
  });
});
