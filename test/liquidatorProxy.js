const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  BN,
  ether,
  time,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { wdiv, wmul, getDefaultArgs } = require("./utils.js");

const MockDataProvider = contract.fromArtifact("MockDataProvider");
const Instrument = contract.fromArtifact("Instrument");

describe("LiquidatorProxy", function () {
  const [admin, owner, liquidator, liquidatee] = accounts;
  const supply = ether("1000000000000");
  const transferAmount = ether("100000000");
  const depositAmount = ether("500");
  const liquidatorDepositAmount = ether("700");
  const mintAmount = ether("1");
  const liquidateAmount = ether("1");
  const originalDaiEthPrice = ether("0.002983");
  const undercollateralizedDaiEthPrice = ether("0.0022");
  const underwaterDaiEthPrice = ether("0.0018");

  let self, snapshotId;

  async function setupDataProvider() {
    // Set Price of ETH/ETH to 1
    await self.dataProvider.setPrice(self.targetAsset.address, ether("1"), {
      from: owner,
    });
    // Set Price of DAI/ETH to 0.002983
    await self.dataProvider.setPrice(
      self.collateralAsset.address,
      originalDaiEthPrice,
      { from: owner }
    );
  }

  async function setupVaults() {
    await self.collateralAsset.transfer(liquidatee, transferAmount, {
      from: liquidator,
    });

    await self.collateralAsset.approve(self.contract.address, supply, {
      from: liquidator,
    });
    await self.collateralAsset.approve(self.contract.address, supply, {
      from: liquidatee,
    });

    // We need to overcollateralize the liquidator here
    await self.contract.depositAndMint(liquidatorDepositAmount, mintAmount, {
      from: liquidator,
    });
    await self.contract.depositAndMint(depositAmount, mintAmount, {
      from: liquidatee,
    });
  }

  async function makeVaultsUndercollateralized() {
    // Vault will be 110% CR
    // 0.0022 * 500 = 1.1
    await self.dataProvider.setPrice(
      self.collateralAsset.address,
      undercollateralizedDaiEthPrice,
      { from: owner }
    );
  }

  async function makeVaultsUnderwater() {
    // Vault will be 90% CR
    // 0.0018 * 500 = 0.9
    await self.dataProvider.setPrice(
      self.collateralAsset.address,
      underwaterDaiEthPrice,
      { from: owner }
    );
  }

  before(async function () {
    const {
      targetAsset,
      colAsset,
      instrument,
      dToken,
      liquidatorProxy,
      args,
    } = await getDefaultArgs(admin, owner, liquidator);

    self = this;
    this.args = args;
    this.targetAsset = targetAsset;
    this.dToken = dToken;
    this.collateralAsset = colAsset;
    this.contract = instrument;
    this.liquidatorProxy = liquidatorProxy;
    this.dataProvider = await MockDataProvider.at(
      await this.contract.dataProvider()
    );

    await setupDataProvider(this);
    await setupVaults(this);
  });

  describe("#owner", () => {
    it("returns the correct owner", async function () {
      assert.equal(await this.liquidatorProxy.owner(), owner);
    });
  });

  describe("#vaultCollateralizationRatio", () => {
    it("returns the correct col ratio", async function () {
      const colRatio = await this.contract.vaultCollateralizationRatio(
        liquidatee,
        { from: liquidatee }
      );
      assert.equal(colRatio.toString(), ether("1.4915"));
    });
  });

  describe("#isLiquidatable", () => {
    beforeEach(async () => {
      snapShot = await helper.takeSnapshot();
      snapshotId = snapShot["result"];
    });

    afterEach(async () => {
      await helper.revertToSnapShot(snapshotId);
    });

    it("returns false when vault is not liquidatable", async function () {
      const isLiquidatable = await this.contract.isLiquidatable(liquidatee, {
        from: liquidatee,
      });
      assert.equal(isLiquidatable, false);
    });

    it("returns true when vault is liquidatable", async function () {
      await makeVaultsUndercollateralized();
      const isLiquidatable = await this.contract.isLiquidatable(liquidatee, {
        from: liquidatee,
      });
      assert.equal(isLiquidatable, true);
    });
  });
});

//   describe("#liquidate", () => {
//     beforeEach(async () => {
//       snapShot = await helper.takeSnapshot();
//       snapshotId = snapShot["result"];
//     });

//     afterEach(async () => {
//       await helper.revertToSnapShot(snapshotId);
//     });

//     it("reverts when the instrument is settled", async function () {
//       const newTimestamp = 1 + parseInt(this.args.expiry);
//       time.increaseTo(newTimestamp);

//       await this.contract.settle({ from: liquidator });

//       const tx = this.liquidatorProxy.liquidate(
//         this.contract.address,
//         liquidatee,
//         liquidateAmount,
//         { from: liquidator }
//       );
//       await expectRevert(tx, "Instrument must not be expired");
//     });

//     it("reverts when liquidating more than debt amount", async function () {
//       const tx = this.liquidatorProxy.liquidate(
//         this.contract.address,
//         liquidatee,
//         liquidateAmount.add(new BN("1")),
//         { from: liquidator }
//       );
//       await expectRevert(tx, "Cannot liquidate more than debt");
//     });

//     it("reverts when vault col ratio >= 150%", async function () {
//       const tx = this.liquidatorProxy.liquidate(
//         this.contract.address,
//         liquidatee,
//         liquidateAmount,
//         { from: liquidator }
//       );
//       await expectRevert(tx, "Vault not liquidatable");
//     });

//     // PENDING WITHDRAW FUNCTION
//     // it("reverts when the liquidator is undercollateralized after liquidation", async function () {
//     //   // We need to withdraw some collateral from the liquidator's vault
//     //   // so we can make it undercollateralized during liquidation
//     //   await this.contract.withdraw()

//     //   await makeVaultsUndercollateralized();

//     //   const tx = this.liquidatorProxy.liquidate(
//     //     this.contract.address,
//     //     liquidatee,
//     //     liquidateAmount,
//     //     { from: liquidator }
//     //   );
//     //   await expectRevert(tx, "Liquidator is undercollateralized");
//     // });

//     it("emits event and changes vault balance correctly", async function () {
//       await makeVaultsUndercollateralized();

//       const receipt = await this.liquidatorProxy.liquidate(
//         this.contract.address,
//         liquidatee,
//         liquidateAmount,
//         { from: liquidator }
//       );

//       await expectEvent.inTransaction(receipt.tx, Instrument, "Repaid", {
//         repayer: liquidator,
//         vault: liquidatee,
//         amount: liquidateAmount,
//       });

//       const newLiquidatorDebt = mintAmount.add(liquidateAmount);
//       const collateralLiquidated = wdiv(
//         liquidateAmount,
//         undercollateralizedDaiEthPrice
//       );
//       const collateralLiquidatedPlusIncentive = wmul(
//         collateralLiquidated,
//         ether("1.05")
//       );

//       const newLiquidatorCollateral = liquidatorDepositAmount.add(
//         collateralLiquidatedPlusIncentive
//       );
//       const newLiquidateeCollateral = depositAmount.sub(
//         collateralLiquidatedPlusIncentive
//       );

//       await expectEvent.inTransaction(receipt.tx, Instrument, "Liquidated", {
//         liquidator,
//         liquidated: liquidatee,
//         liquidateAmount,
//         collateralLiquidated: collateralLiquidatedPlusIncentive,
//         newLiquidatorCollateral,
//         newLiquidatorDebt,
//       });

//       const liquidatorVault = await this.contract.getVault(liquidator);
//       assert.equal(
//         liquidatorVault._collateral.toString(),
//         newLiquidatorCollateral
//       );
//       assert.equal(liquidatorVault._dTokenDebt.toString(), newLiquidatorDebt);

//       // The liquidator's dToken balance should also go down when repaying debt
//       const newBalance = mintAmount.sub(liquidateAmount);
//       assert.equal(
//         (await this.dToken.balanceOf(liquidator)).toString(),
//         newBalance
//       );

//       const liquidatedVault = await this.contract.getVault(liquidatee);
//       assert.equal(
//         liquidatedVault._collateral.toString(),
//         newLiquidateeCollateral
//       );
//       assert.equal(liquidatedVault._dTokenDebt.toString(), "0");

//       // The end result should be that the liquidated vault is not liquidatable anymore
//       // and it must have no debt
//       assert.equal(await this.contract.isLiquidatable(liquidatee), false);
//     });

//     it("should liquidate the entire vault's collateral when underwater", async function () {
//       await makeVaultsUnderwater();

//       const liquidatedVault = await this.contract.getVault(liquidatee);

//       const receipt = await this.liquidatorProxy.liquidate(
//         this.contract.address,
//         liquidatee,
//         liquidateAmount,
//         { from: liquidator }
//       );

//       await expectEvent.inTransaction(receipt.tx, Instrument, "Liquidated", {
//         liquidator,
//         liquidated: liquidatee,
//         collateralLiquidated: liquidatedVault._collateral,
//       });
//     });
//   });
// });
