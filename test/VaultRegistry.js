const { assert } = require("chai");
const { ethers } = require("hardhat");
const { getContractFactory } = ethers;

describe("VaultRegistry", () => {
  before(async function () {
    const [signer] = await ethers.getSigners();
    this.signer = signer;
    const VaultRegistry = await getContractFactory("VaultRegistry");
    this.registry = await VaultRegistry.connect(this.signer).deploy();
  });

  describe("#constructor", () => {
    it("initializes the owner correctly", async function () {
      assert.equal(await this.registry.owner(), this.signer.address);
    });
  });
});
