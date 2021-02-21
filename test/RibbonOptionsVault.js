const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { getContractAt } = ethers;
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy, getDefaultArgs } = require("./helpers/utils");

let owner, user;
let userSigner, ownerSigner, managerSigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";

describe("RibbonOptionsVault", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [
      adminSigner,
      ownerSigner,
      userSigner,
      managerSigner,
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    manager = managerSigner.address;

    const {
      factory,
      protocolAdapterLib,
      gammaAdapter,
    } = await getDefaultArgs();
    await factory.setAdapter("OPYN_GAMMA", gammaAdapter.address);

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

    await this.vault.connect(ownerSigner).setManager(manager);

    this.optionTerms = [
      WETH_ADDRESS,
      USDC_ADDRESS,
      WETH_ADDRESS,
      "1614326400",
      parseEther("960"),
      2,
    ];

    this.oTokenAddress = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

    this.oToken = await getContractAt("IERC20", this.oTokenAddress);

    this.weth = await getContractAt("IERC20", WETH_ADDRESS);
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("#setManager", () => {
    it("reverts when not owner call", async function () {
      await expect(this.vault.setManager(manager)).to.be.revertedWith(
        "caller is not the owner"
      );
    });

    it("sets the manager", async function () {
      await this.vault.connect(ownerSigner).setManager(manager);
      assert.equal(await this.vault.manager(), manager);
    });
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

    it("mints oTokens and deposits collateral into vault", async function () {
      const startMarginBalance = await this.weth.balanceOf(MARGIN_POOL);

      await this.vault
        .connect(managerSigner)
        .writeOptions(this.optionTerms, { from: manager });

      assert.equal(
        (await this.weth.balanceOf(MARGIN_POOL))
          .sub(startMarginBalance)
          .toString(),
        parseEther("1")
      );

      assert.equal(
        await this.oToken.balanceOf(this.vault.address),
        "100000000"
      );

      assert.equal(await this.vault.currentOption(), this.oTokenAddress);
    });
  });
});
