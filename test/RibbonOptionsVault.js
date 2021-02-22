const { expect, assert } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { signOrderForSwap } = require("./helpers/signature");
const { constants, getContractAt } = ethers;
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy, getDefaultArgs } = require("./helpers/utils");

let owner, user;
let userSigner, ownerSigner, managerSigner, counterpartySigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const SWAP_ADDRESS = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";

describe("RibbonOptionsVault", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [
      adminSigner,
      ownerSigner,
      userSigner,
      managerSigner,
      counterpartySigner,
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    manager = managerSigner.address;
    counterparty = counterpartySigner.address;

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

    this.weth = await getContractAt("IWETH", WETH_ADDRESS);

    this.airswap = await getContractAt("ISwap", SWAP_ADDRESS);
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("#asset", () => {
    it("returns the asset", async function () {
      assert.equal(await this.vault.asset(), WETH_ADDRESS);
    });
  });

  describe("#exchangeMechanism", () => {
    it("returns the exchange mechanism", async function () {
      assert.equal(await this.vault.exchangeMechanism(), 1);
    });
  });

  describe("#owner", () => {
    it("returns the owner", async function () {
      assert.equal(await this.vault.owner(), owner);
    });
  });

  describe("#setManager", () => {
    time.revertToSnapshotAfterTest();

    it("reverts when not owner call", async function () {
      await expect(this.vault.setManager(manager)).to.be.revertedWith(
        "caller is not the owner"
      );
    });

    it("sets the first manager", async function () {
      await this.vault.connect(ownerSigner).setManager(manager);
      assert.equal(await this.vault.manager(), manager);
      assert.isTrue(
        await this.airswap.signerAuthorizations(this.vault.address, manager)
      );
    });

    it("changes the manager", async function () {
      await this.vault.connect(ownerSigner).setManager(owner);
      await this.vault.connect(ownerSigner).setManager(manager);
      assert.equal(await this.vault.manager(), manager);
      assert.isFalse(
        await this.airswap.signerAuthorizations(this.vault.address, owner)
      );
      assert.isTrue(
        await this.airswap.signerAuthorizations(this.vault.address, manager)
      );
    });
  });

  describe("#depositETH", () => {
    time.revertToSnapshotAfterTest();

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

    it("reverts when not called with manager", async function () {
      await expect(
        this.vault
          .connect(userSigner)
          .writeOptions(this.optionTerms, { from: user })
      ).to.be.revertedWith("Only manager");
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

  describe("signing an order message", () => {
    it("signs an order message", async function () {
      const sellToken = this.oTokenAddress;
      const buyToken = WETH_ADDRESS;
      const buyAmount = parseEther("0.1");
      const sellAmount = BigNumber.from("100000000");

      const signedOrder = await signOrderForSwap({
        vaultAddress: this.vault.address,
        counterpartyAddress: counterparty,
        signer: managerSigner,
        sellToken,
        buyToken,
        sellAmount: sellAmount.toString(),
        buyAmount: buyAmount.toString(),
      });

      const { signatory, validator } = signedOrder.signature;
      const {
        wallet: signerWallet,
        token: signerToken,
        amount: signerAmount,
      } = signedOrder.signer;
      const {
        wallet: senderWallet,
        token: senderToken,
        amount: senderAmount,
      } = signedOrder.sender;
      assert.equal(ethers.utils.getAddress(signatory), manager);
      assert.equal(ethers.utils.getAddress(validator), SWAP_ADDRESS);
      assert.equal(ethers.utils.getAddress(signerWallet), this.vault.address);
      assert.equal(ethers.utils.getAddress(signerToken), this.oTokenAddress);
      assert.equal(ethers.utils.getAddress(senderWallet), counterparty);
      assert.equal(ethers.utils.getAddress(senderToken), WETH_ADDRESS);
      assert.equal(signerAmount, sellAmount);
      assert.equal(senderAmount, buyAmount.toString());
    });
  });

  describe("#approveOptionsSale", () => {
    let snapshotId;

    beforeEach(async function () {
      snapshotId = await time.takeSnapshot();

      this.premium = parseEther("0.1");
      this.depositAmount = parseEther("1");
      this.sellAmount = BigNumber.from("100000000");

      const weth = this.weth.connect(counterpartySigner);
      await weth.deposit({ value: this.premium });
      await weth.approve(SWAP_ADDRESS, this.premium);

      await this.vault.depositETH({ value: this.depositAmount });
      await this.vault
        .connect(managerSigner)
        .writeOptions(this.optionTerms, { from: manager });
    });

    afterEach(async function () {
      await time.revertToSnapShot(snapshotId);
    });

    it("creates approval for swap contract", async function () {
      await this.vault.connect(managerSigner).approveOptionsSale();

      assert.equal(
        (
          await this.oToken.allowance(this.vault.address, SWAP_ADDRESS)
        ).toString(),
        this.sellAmount
      );
    });

    it("completes the trade with the counterparty", async function () {
      const signedOrder = await signOrderForSwap({
        vaultAddress: this.vault.address,
        counterpartyAddress: counterparty,
        signer: managerSigner,
        sellToken: this.oTokenAddress,
        buyToken: WETH_ADDRESS,
        sellAmount: this.sellAmount.toString(),
        buyAmount: this.premium.toString(),
      });
      console.log(signedOrder);

      await this.vault.connect(managerSigner).approveOptionsSale();

      await this.airswap.connect(counterpartySigner).swap(signedOrder);
    });
  });
});
