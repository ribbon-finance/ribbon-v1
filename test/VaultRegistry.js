const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { getContractFactory } = ethers;

const fromVault = "0x0000000000000000000000000000000000000069";
const toVault = "0x0000000000000000000000000000000000000042";

describe("VaultRegistry", () => {
  before(async function () {
    const [ownerSigner, userSigner] = await ethers.getSigners();
    this.ownerSigner = ownerSigner;
    this.userSigner = userSigner;
    const VaultRegistry = await getContractFactory("VaultRegistry");
    this.registry = await VaultRegistry.connect(this.ownerSigner).deploy();
  });

  describe("#constructor", () => {
    it("initializes the owner correctly", async function () {
      assert.equal(await this.registry.owner(), this.ownerSigner.address);
    });
  });

  describe("#registerFreeWithdrawal", () => {
    it("registers free withdrawal", async function () {
      const tx = await this.registry.registerFreeWithdrawal(fromVault, toVault);

      expect(tx)
        .to.emit(this.registry, "RegisterWithdrawal")
        .withArgs(fromVault, toVault);

      assert.isTrue(await this.registry.canWithdrawForFree(fromVault, toVault));
    });

    it("reverts when not owner", async function () {
      await expect(
        this.registry
          .connect(this.userSigner)
          .registerFreeWithdrawal(fromVault, toVault)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("#revokeFreeWithdrawal", () => {
    it("revokes free withdrawal", async function () {
      assert.isTrue(await this.registry.canWithdrawForFree(fromVault, toVault));

      const tx = await this.registry.revokeFreeWithdrawal(fromVault, toVault);

      expect(tx)
        .to.emit(this.registry, "RevokeWithdrawal")
        .withArgs(fromVault, toVault);

      assert.isFalse(
        await this.registry.canWithdrawForFree(fromVault, toVault)
      );
    });

    it("reverts when not owner", async function () {
      await expect(
        this.registry
          .connect(this.userSigner)
          .revokeFreeWithdrawal(fromVault, toVault)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("#registerCrossTrade", () => {
    it("registers cross trade", async function () {
      const tx = await this.registry.registerCrossTrade(fromVault, toVault);

      expect(tx)
        .to.emit(this.registry, "RegisterCrossTrade")
        .withArgs(fromVault, toVault);

      assert.isTrue(await this.registry.canCrossTrade(fromVault, toVault));
    });

    it("reverts when not owner", async function () {
      await expect(
        this.registry
          .connect(this.userSigner)
          .registerCrossTrade(fromVault, toVault)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("#revokeCrossTrade", () => {
    it("revokes free withdrawal", async function () {
      assert.isTrue(await this.registry.canCrossTrade(fromVault, toVault));

      const tx = await this.registry.revokeCrossTrade(fromVault, toVault);

      expect(tx)
        .to.emit(this.registry, "RevokeCrossTrade")
        .withArgs(fromVault, toVault);

      assert.isFalse(await this.registry.canCrossTrade(fromVault, toVault));
    });

    it("reverts when not owner", async function () {
      await expect(
        this.registry
          .connect(this.userSigner)
          .revokeCrossTrade(fromVault, toVault)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
