const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy, getDefaultArgs } = require("./helpers/utils");

let owner, user;
let userSigner, ownerSigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

describe("RibbonOptionsVault", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [adminSigner, ownerSigner, userSigner] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;

    const { factory, protocolAdapterLib } = await getDefaultArgs();

    const initializeTypes = ["address", "address"];
    const initializeArgs = [owner, factory.address];

    this.vault = (
      await deployProxy(
        "RibbonOptionsVault",
        adminSigner,
        initializeTypes,
        initializeArgs,
        {
          libraries: {
            ProtocolAdapter: protocolAdapterLib.address,
          },
        }
      )
    ).connect(userSigner);

    this.optionTerms = [
      WETH_ADDRESS,
      USDC_ADDRESS,
      WETH_ADDRESS,
      "1614326400",
      parseEther("960"),
      2,
    ];
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("#depositETH", () => {
    let snapshotId;

    beforeEach(async function () {
      snapshotId = await time.takeSnapshot();
    });

    afterEach(async () => {
      await time.revertToSnapShot(snapshotId);
    });

    it("deposits successfully", async function () {
      const depositAmount = parseEther("1");
      await this.vault.depositETH({ value: depositAmount });

      assert.equal((await this.vault.totalSupply()).toString(), depositAmount);
    });
  });

  describe("#writeOptions", () => {
    let snapshotId;

    beforeEach(async function () {
      snapshotId = await time.takeSnapshot();
      this.depositAmount = parseEther("1");
      await this.vault.depositETH({ value: this.depositAmount });
    });

    afterEach(async () => {
      await time.revertToSnapShot(snapshotId);
    });

    it("reverts when not called with owner", async function () {
      await expect(
        this.vault
          .connect(userSigner)
          .writeOptions(this.optionTerms, { from: user })
      ).to.be.revertedWith("caller is not the owner");
    });

    it("mints oTokens", async function () {
      await this.vault
        .connect(ownerSigner)
        .writeOptions(this.optionTerms, { from: owner });
    });
  });
});
