const { expect, assert } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { signOrderForSwap } = require("./helpers/signature");
const { getContractAt } = ethers;
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy, getDefaultArgs, wmul } = require("./helpers/utils");

let owner, user;
let userSigner, ownerSigner, managerSigner, counterpartySigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const SWAP_ADDRESS = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";

const LOCKED_RATIO = parseEther("0.9");

describe("RibbonETHCoveredCall", () => {
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

    this.managerWallet = ethers.Wallet.fromMnemonic(
      process.env.TEST_MNEMONIC,
      "m/44'/60'/0'/0/3"
    );

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
        "RibbonETHCoveredCall",
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

  describe("#name", () => {
    it("returns the name", async function () {
      assert.equal(await this.vault.name(), "Ribbon ETH Covered Call Vault");
    });
  });

  describe("#symbol", () => {
    it("returns the symbol", async function () {
      assert.equal(await this.vault.symbol(), "rETH-COVCALL");
    });
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
      const res = await this.vault.depositETH({ value: depositAmount });
      const receipt = await res.wait();

      assert.isAtMost(receipt.gasUsed.toNumber(), 150000);

      assert.equal((await this.vault.totalSupply()).toString(), depositAmount);
      assert.equal(
        (await this.vault.balanceOf(user)).toString(),
        depositAmount
      );
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
        signerPrivateKey: this.managerWallet.privateKey,
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

  describe("#writeOptions", () => {
    let snapshotId;

    beforeEach(async function () {
      snapshotId = await time.takeSnapshot();
      this.depositAmount = parseEther("1");
      this.expectedMintAmount = BigNumber.from("90000000");
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

      const res = await this.vault
        .connect(managerSigner)
        .writeOptions(this.optionTerms, { from: manager });

      expect(res)
        .to.emit(this.vault, "WriteOptions")
        .withArgs(manager, this.oTokenAddress, this.expectedMintAmount);

      const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO);
      const availableAmount = wmul(
        this.depositAmount,
        parseEther("1").sub(LOCKED_RATIO)
      );

      assert.equal(
        (await this.vault.availableToWithdraw()).toString(),
        availableAmount
      );

      assert.equal(
        (await this.weth.balanceOf(MARGIN_POOL))
          .sub(startMarginBalance)
          .toString(),
        lockedAmount.toString()
      );

      assert.deepEqual(
        await this.oToken.balanceOf(this.vault.address),
        this.expectedMintAmount
      );

      assert.equal(await this.vault.currentOption(), this.oTokenAddress);

      assert.deepEqual(
        await this.oToken.allowance(this.vault.address, SWAP_ADDRESS),
        this.expectedMintAmount
      );
    });
  });

  describe("Swapping with counterparty", () => {
    let snapshotId;

    beforeEach(async function () {
      snapshotId = await time.takeSnapshot();

      this.premium = parseEther("0.1");
      this.depositAmount = parseEther("1");
      this.sellAmount = BigNumber.from("90000000");

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

    it("completes the trade with the counterparty", async function () {
      const startSellTokenBalance = await this.oToken.balanceOf(
        this.vault.address
      );
      const startBuyTokenBalance = await this.weth.balanceOf(
        this.vault.address
      );

      const signedOrder = await signOrderForSwap({
        vaultAddress: this.vault.address,
        counterpartyAddress: counterparty,
        signerPrivateKey: this.managerWallet.privateKey,
        sellToken: this.oTokenAddress,
        buyToken: WETH_ADDRESS,
        sellAmount: this.sellAmount.toString(),
        buyAmount: this.premium.toString(),
      });

      const res = await this.airswap
        .connect(counterpartySigner)
        .swap(signedOrder);

      expect(res)
        .to.emit(this.oToken, "Transfer")
        .withArgs(this.vault.address, counterparty, this.sellAmount);

      expect(res)
        .to.emit(this.weth, "Transfer")
        .withArgs(counterparty, this.vault.address, this.premium);

      assert.deepEqual(
        await this.oToken.balanceOf(this.vault.address),
        startSellTokenBalance.sub(this.sellAmount)
      );
      assert.deepEqual(
        await this.weth.balanceOf(this.vault.address),
        startBuyTokenBalance.add(this.premium)
      );
    });
  });

  describe("#availableToWithdraw", () => {
    let snapshotId;

    beforeEach(async function () {
      snapshotId = await time.takeSnapshot();

      this.depositAmount = parseEther("1");

      await this.vault.depositETH({ value: this.depositAmount });

      assert.equal(
        (await this.vault.totalSupply()).toString(),
        this.depositAmount
      );

      await this.vault
        .connect(managerSigner)
        .writeOptions(this.optionTerms, { from: manager });
    });

    afterEach(async () => {
      await time.revertToSnapShot(snapshotId);
    });

    it("returns the 10% reserve amount", async function () {
      assert.equal(
        (await this.vault.availableToWithdraw()).toString(),
        wmul(this.depositAmount, parseEther("0.1")).toString()
      );
    });

    it("returns the free balance - locked, if free > locked", async function () {
      await this.vault.availableToWithdraw();

      await this.vault.depositETH({ value: parseEther("10") });

      const lockedAmount = wmul(this.depositAmount, parseEther("0.9"));
      const freeAmount = parseEther("10").add(
        wmul(this.depositAmount, parseEther("0.1"))
      );

      assert.equal(
        (await this.vault.availableToWithdraw()).toString(),
        freeAmount.sub(lockedAmount)
      );
    });
  });
});
