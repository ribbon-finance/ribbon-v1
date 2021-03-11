const { expect, assert } = require("chai");
const { BigNumber, constants } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { provider, getContractAt } = ethers;
const { parseEther } = ethers.utils;
const { createOrder, signTypedDataOrder } = require("@airswap/utils");

const time = require("./helpers/time");
const {
  deployProxy,
  getDefaultArgs,
  wmul,
  setupOracle,
  setOpynOracleExpiryPrice,
} = require("./helpers/utils");

let owner, user, feeRecipient;
let userSigner, ownerSigner, managerSigner, counterpartySigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const SWAP_ADDRESS = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";
const SWAP_CONTRACT = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";
const TRADER_AFFILIATE = "0xFf98F0052BdA391F8FaD266685609ffb192Bef25";

const LOCKED_RATIO = parseEther("0.9");
const WITHDRAWAL_BUFFER = parseEther("1").sub(LOCKED_RATIO);
const gasPrice = parseUnits("1", "gwei");

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
      feeRecipientSigner,
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    manager = managerSigner.address;
    counterparty = counterpartySigner.address;
    feeRecipient = feeRecipientSigner.address;

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

    this.factory = factory;
    this.protocolAdapterLib = protocolAdapterLib;

    const initializeTypes = ["address", "address", "uint256"];
    const initializeArgs = [owner, feeRecipient, parseEther("500")];
    const deployArgs = [factory.address];

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
        },
        deployArgs
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
      WETH_ADDRESS,
    ];

    this.oTokenAddress = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

    this.oToken = await getContractAt("IERC20", this.oTokenAddress);

    this.weth = await getContractAt("IWETH", WETH_ADDRESS);

    this.airswap = await getContractAt("ISwap", SWAP_ADDRESS);
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("constructor", () => {
    time.revertToSnapshotAfterEach();

    it("reverts when deployed with 0x0 factory", async function () {
      const VaultContract = await ethers.getContractFactory(
        "RibbonETHCoveredCall",
        {
          libraries: {
            ProtocolAdapter: this.protocolAdapterLib.address,
          },
        }
      );
      await expect(
        VaultContract.deploy(constants.AddressZero)
      ).to.be.revertedWith("!_factory");
    });

    it("reverts when adapter not set yet", async function () {
      const VaultContract = await ethers.getContractFactory(
        "RibbonETHCoveredCall",
        {
          libraries: {
            ProtocolAdapter: this.protocolAdapterLib.address,
          },
        }
      );

      await this.factory.setAdapter("OPYN_GAMMA", constants.AddressZero);

      await expect(
        VaultContract.deploy(this.factory.address)
      ).to.be.revertedWith("Adapter not set");
    });
  });

  describe("#initialize", () => {
    it("initializes with correct values", async function () {
      assert.equal((await this.vault.cap()).toString(), parseEther("500"));
      assert.equal(await this.vault.factory(), this.factory.address);
      assert.equal(await this.vault.owner(), owner);
      assert.equal(await this.vault.feeRecipient(), feeRecipient);
    });

    it("cannot be initialized twice", async function () {
      await expect(
        this.vault.initialize(owner, feeRecipient, parseEther("500"))
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
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

    it("reverts when setting 0x0 as manager", async function () {
      await expect(
        this.vault.connect(ownerSigner).setManager(constants.AddressZero)
      ).to.be.revertedWith("New manager cannot be 0x0");
    });

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
    time.revertToSnapshotAfterEach();

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
      expect(res)
        .to.emit(this.vault, "Deposit")
        .withArgs(user, depositAmount, depositAmount);
    });

    it("returns the correct number of shares back", async function () {
      // first user gets 3 shares
      await this.vault
        .connect(userSigner)
        .depositETH({ value: parseEther("3") });
      assert.equal(
        (await this.vault.balanceOf(user)).toString(),
        parseEther("3")
      );

      // simulate the vault accumulating more WETH
      await this.weth.connect(userSigner).deposit({ value: parseEther("1") });
      await this.weth
        .connect(userSigner)
        .transfer(this.vault.address, parseEther("1"));

      assert.equal(
        (await this.vault.totalBalance()).toString(),
        parseEther("4")
      );

      // formula:
      // (depositAmount * totalSupply) / total
      // (1 * 3) / 4 = 0.75 shares
      const res = await this.vault
        .connect(counterpartySigner)
        .depositETH({ value: parseEther("1") });
      assert.equal(
        (await this.vault.balanceOf(counterparty)).toString(),
        parseEther("0.75")
      );
      expect(res)
        .to.emit(this.vault, "Deposit")
        .withArgs(counterparty, parseEther("1"), parseEther("0.75"));
    });

    it("accounts for the amounts that are locked", async function () {
      // first user gets 3 shares
      await this.vault
        .connect(userSigner)
        .depositETH({ value: parseEther("3") });

      // simulate the vault accumulating more WETH
      await this.weth.connect(userSigner).deposit({ value: parseEther("1") });
      await this.weth
        .connect(userSigner)
        .transfer(this.vault.address, parseEther("1"));

      await this.vault
        .connect(managerSigner)
        .rollToNextOption(this.optionTerms);

      // formula:
      // (depositAmount * totalSupply) / total
      // (1 * 3) / 4 = 0.75 shares
      await this.vault
        .connect(counterpartySigner)
        .depositETH({ value: parseEther("1") });
      assert.equal(
        (await this.vault.balanceOf(counterparty)).toString(),
        parseEther("0.75")
      );
    });

    it("reverts when no value passed", async function () {
      await expect(
        this.vault.connect(userSigner).depositETH({ value: 0 })
      ).to.be.revertedWith("No value passed");
    });
  });

  describe("#deposit", () => {
    time.revertToSnapshotAfterEach();

    it("deposits successfully", async function () {
      const depositAmount = parseEther("1");
      await this.weth.connect(userSigner).deposit({ value: depositAmount });
      await this.weth
        .connect(userSigner)
        .approve(this.vault.address, depositAmount);

      const res = await this.vault.deposit(depositAmount);
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

  describe("#rollToNextOption", () => {
    time.revertToSnapshotAfterEach(async function () {
      this.premium = parseEther("0.1");
      this.depositAmount = parseEther("1");
      this.expectedMintAmount = BigNumber.from("90000000");
      await this.vault.depositETH({ value: this.depositAmount });

      this.oracle = await setupOracle(ownerSigner);

      this.depositAmount = parseEther("1");
      this.sellAmount = BigNumber.from("90000000");

      const weth = this.weth.connect(counterpartySigner);
      await weth.deposit({ value: this.premium });
      await weth.approve(SWAP_ADDRESS, this.premium);
    });

    it("reverts when not called with manager", async function () {
      await expect(
        this.vault
          .connect(userSigner)
          .rollToNextOption(this.optionTerms, { from: user })
      ).to.be.revertedWith("Only manager");
    });

    it("mints oTokens and deposits collateral into vault", async function () {
      const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO);
      const availableAmount = wmul(
        this.depositAmount,
        parseEther("1").sub(LOCKED_RATIO)
      );

      const startMarginBalance = await this.weth.balanceOf(MARGIN_POOL);

      const res = await this.vault
        .connect(managerSigner)
        .rollToNextOption(this.optionTerms, { from: manager });

      expect(res).to.not.emit(this.vault, "CloseShort");

      expect(res)
        .to.emit(this.vault, "OpenShort")
        .withArgs(this.oTokenAddress, lockedAmount, manager);

      assert.equal((await this.vault.lockedAmount()).toString(), lockedAmount);

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

    it("burns otokens and withdraws from vault, before expiry", async function () {
      const firstOption = "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3";
      const secondOption = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

      const firstTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1610697600",
            parseEther("1480"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      expect(firstTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(firstOption, wmul(this.depositAmount, LOCKED_RATIO), manager);

      // 90% of the vault's balance is allocated to short
      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        parseEther("0.1").toString()
      );

      const secondTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1614326400",
            parseEther("960"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      assert.equal(await this.vault.currentOption(), secondOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1614326400);

      // Withdraw the original short position, which is 90% of the vault
      expect(secondTx)
        .to.emit(this.vault, "CloseShort")
        .withArgs(firstOption, parseEther("0.9"), manager);

      expect(secondTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(secondOption, parseEther("0.9"), manager);

      // should still be 10% because the 90% withdrawn from the 1st short
      // is re-allocated back into the
      // should return back to the original amount now that the short is closed
      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        parseEther("0.1").toString()
      );
    });

    it("reverts when not enough otokens to burn", async function () {
      const firstOption = "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3";
      const secondOption = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

      await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1610697600",
            parseEther("1480"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      // Perform the swap to deposit premiums and remove otokens
      const signedOrder = await signOrderForSwap({
        vaultAddress: this.vault.address,
        counterpartyAddress: counterparty,
        signerPrivateKey: this.managerWallet.privateKey,
        sellToken: firstOption,
        buyToken: WETH_ADDRESS,
        sellAmount: this.sellAmount.toString(),
        buyAmount: this.premium.toString(),
      });

      await this.airswap.connect(counterpartySigner).swap(signedOrder);

      await expect(
        this.vault
          .connect(managerSigner)
          .rollToNextOption(
            [
              WETH_ADDRESS,
              USDC_ADDRESS,
              WETH_ADDRESS,
              "1614326400",
              parseEther("960"),
              2,
              WETH_ADDRESS,
            ],
            { from: manager }
          )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("withdraws and roll funds into next option, after expiry ITM", async function () {
      const firstOption = "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3";
      const secondOption = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

      const firstTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1610697600",
            parseEther("1480"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      assert.equal(await this.vault.currentOption(), firstOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1610697600);

      expect(firstTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(firstOption, wmul(this.depositAmount, LOCKED_RATIO), manager);

      // Perform the swap to deposit premiums and remove otokens
      const signedOrder = await signOrderForSwap({
        vaultAddress: this.vault.address,
        counterpartyAddress: counterparty,
        signerPrivateKey: this.managerWallet.privateKey,
        sellToken: firstOption,
        buyToken: WETH_ADDRESS,
        sellAmount: this.sellAmount.toString(),
        buyAmount: this.premium.toString(),
      });

      await this.airswap.connect(counterpartySigner).swap(signedOrder);

      // only the premium should be left over because the funds are locked into Opyn
      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        wmul(this.depositAmount, WITHDRAWAL_BUFFER).add(this.premium)
      );

      // withdraw 100% because it's OTM
      await setOpynOracleExpiryPrice(
        this.oracle,
        await this.vault.currentOptionExpiry(),
        BigNumber.from("148000000000").sub(BigNumber.from("1"))
      );

      const secondTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1614326400",
            parseEther("960"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      assert.equal(await this.vault.currentOption(), secondOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1614326400);

      expect(secondTx)
        .to.emit(this.vault, "CloseShort")
        .withArgs(firstOption, wmul(this.depositAmount, LOCKED_RATIO), manager);

      expect(secondTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(secondOption, parseEther("0.99"), manager);

      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        wmul(this.depositAmount.add(this.premium), WITHDRAWAL_BUFFER)
      );
    });

    it("withdraws and roll funds into next option, after expiry OTM", async function () {
      const firstOption = "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3";
      const secondOption = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

      const firstTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1610697600",
            parseEther("1480"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      expect(firstTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(firstOption, wmul(this.depositAmount, LOCKED_RATIO), manager);

      // Perform the swap to deposit premiums and remove otokens
      const signedOrder = await signOrderForSwap({
        vaultAddress: this.vault.address,
        counterpartyAddress: counterparty,
        signerPrivateKey: this.managerWallet.privateKey,
        sellToken: firstOption,
        buyToken: WETH_ADDRESS,
        sellAmount: this.sellAmount.toString(),
        buyAmount: this.premium.toString(),
      });

      await this.airswap.connect(counterpartySigner).swap(signedOrder);

      // only the premium should be left over because the funds are locked into Opyn
      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        wmul(this.depositAmount, WITHDRAWAL_BUFFER).add(this.premium)
      );

      // withdraw 100% because it's OTM
      await setOpynOracleExpiryPrice(
        this.oracle,
        await this.vault.currentOptionExpiry(),
        BigNumber.from("160000000000")
      );

      const secondTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption(
          [
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            "1614326400",
            parseEther("960"),
            2,
            WETH_ADDRESS,
          ],
          { from: manager }
        );

      assert.equal(await this.vault.currentOption(), secondOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1614326400);

      expect(secondTx)
        .to.emit(this.vault, "CloseShort")
        .withArgs(firstOption, parseEther("0.8325"), manager);

      expect(secondTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(secondOption, parseEther("0.92925"), manager);

      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        parseEther("0.10325")
      );
    });
  });

  describe("Swapping with counterparty", () => {
    time.revertToSnapshotAfterEach(async function () {
      this.premium = parseEther("0.1");
      this.depositAmount = parseEther("1");
      this.sellAmount = BigNumber.from("90000000");

      const weth = this.weth.connect(counterpartySigner);
      await weth.deposit({ value: this.premium });
      await weth.approve(SWAP_ADDRESS, this.premium);

      await this.vault.depositETH({ value: this.depositAmount });
      await this.vault
        .connect(managerSigner)
        .rollToNextOption(this.optionTerms, { from: manager });
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

      const wethERC20 = await getContractAt("IERC20", this.weth.address);

      expect(res)
        .to.emit(wethERC20, "Transfer")
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
    time.revertToSnapshotAfterEach(async function () {
      this.depositAmount = parseEther("1");

      await this.vault.depositETH({ value: this.depositAmount });

      assert.equal(
        (await this.vault.totalSupply()).toString(),
        this.depositAmount
      );

      await this.vault
        .connect(managerSigner)
        .rollToNextOption(this.optionTerms, { from: manager });
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

      const freeAmount = wmul(
        parseEther("10").add(this.depositAmount),
        parseEther("0.1")
      );

      assert.equal(
        (await this.vault.availableToWithdraw()).toString(),
        freeAmount
      );
    });
  });

  describe("#withdrawETH", () => {
    time.revertToSnapshotAfterEach();

    it("reverts when withdrawing more than 10%", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      await expect(this.vault.withdrawETH(parseEther("1"))).to.be.revertedWith(
        "Cannot withdraw more than available"
      );
    });

    it("should withdraw funds, sending withdrawal fee to feeRecipient if <10%", async function () {
      await this.vault.depositETH({ value: parseEther("1") });
      const startETHBalance = await provider.getBalance(user);

      const res = await this.vault.withdrawETH(parseEther("0.1"), { gasPrice });
      const receipt = await res.wait();
      const gasFee = gasPrice.mul(receipt.gasUsed);

      // Fee is sent to feeRecipient
      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        parseEther("0.9").toString()
      );

      assert.equal(
        (await this.weth.balanceOf(feeRecipient)).toString(),
        parseEther("0.001").toString()
      );

      assert.equal(
        (await provider.getBalance(user))
          .add(gasFee)
          .sub(startETHBalance)
          .toString(),
        parseEther("0.099").toString()
      );

      // Share amount is burned
      assert.equal(
        (await this.vault.balanceOf(user)).toString(),
        parseEther("0.9")
      );

      assert.equal(
        (await this.vault.totalSupply()).toString(),
        parseEther("0.9")
      );

      expect(res)
        .to.emit(this.vault, "Withdraw")
        .withArgs(user, parseEther("0.099"), parseEther("0.9"));
    });

    it("should withdraw funds up to 10% of pool", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      // simulate the vault accumulating more WETH
      await this.weth.connect(userSigner).deposit({ value: parseEther("1") });
      await this.weth
        .connect(userSigner)
        .transfer(this.vault.address, parseEther("1"));

      assert.equal(
        (await this.vault.availableToWithdraw()).toString(),
        parseEther("0.2")
      );

      // reverts when withdrawing >0.2 ETH
      await expect(
        this.vault.withdrawETH(parseEther("0.2").add(BigNumber.from("1")))
      ).to.be.revertedWith("Cannot withdraw more than available");

      const tx = await this.vault.withdrawETH(parseEther("0.1"));
      const receipt = await tx.wait();
      assert.isAtMost(receipt.gasUsed.toNumber(), 150000);
    });

    it("should only withdraw original deposit amount minus fees if vault doesn't expand", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      const startETHBalance = await provider.getBalance(user);

      await this.vault
        .connect(counterpartySigner)
        .depositETH({ value: parseEther("10") });

      // As the pool expands, using 1 pool share will redeem more amount of collateral
      const res = await this.vault.withdrawETH(parseEther("1"), { gasPrice });
      const receipt = await res.wait();

      // 0.99 ETH because 1% paid to fees
      const gasUsed = receipt.gasUsed.mul(gasPrice);
      assert.equal(
        (await provider.getBalance(user))
          .add(gasUsed)
          .sub(startETHBalance)
          .toString(),
        parseEther("0.99").toString()
      );
    });

    it("should withdraw more collateral when the balance increases", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      const startETHBalance = await provider.getBalance(user);

      await this.vault
        .connect(counterpartySigner)
        .depositETH({ value: parseEther("10") });

      await this.weth
        .connect(counterpartySigner)
        .deposit({ value: parseEther("10") });
      await this.weth
        .connect(counterpartySigner)
        .transfer(this.vault.address, parseEther("10"));

      // As the pool expands, using 1 pool share will redeem more amount of collateral
      const res = await this.vault.withdrawETH(parseEther("1"), { gasPrice });
      const receipt = await res.wait();

      const gasUsed = receipt.gasUsed.mul(gasPrice);
      assert.equal(
        (await provider.getBalance(user))
          .add(gasUsed)
          .sub(startETHBalance)
          .toString(),
        BigNumber.from("1889999999999999999")
      );
    });

    it("should revert if not enough shares", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      await this.vault
        .connect(counterpartySigner)
        .depositETH({ value: parseEther("10") });

      await expect(
        this.vault.withdrawETH(parseEther("1").add(BigNumber.from("1")))
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });

  describe("#withdraw", () => {
    time.revertToSnapshotAfterEach();

    it("should withdraw funds, leaving behind withdrawal fee", async function () {
      await this.vault.depositETH({ value: parseEther("1") });
      await this.vault.withdraw(parseEther("0.1"));
      assert.equal(
        (await this.weth.balanceOf(user)).toString(),
        parseEther("0.099")
      );
    });
  });

  describe("#setCap", () => {
    time.revertToSnapshotAfterEach();

    it("should revert if not manager", async function () {
      await expect(
        this.vault.connect(userSigner).setCap(parseEther("10"))
      ).to.be.revertedWith("Only manager");
    });

    it("should set the new cap", async function () {
      await this.vault.connect(managerSigner).setCap(parseEther("10"));
      assert.equal((await this.vault.cap()).toString(), parseEther("10"));
    });

    it("should revert when depositing over the cap", async function () {
      await this.vault.connect(managerSigner).setCap(parseEther("1"));

      await expect(
        this.vault.depositETH({
          value: parseEther("1").add(BigNumber.from("1")),
        })
      ).to.be.revertedWith("Cap exceeded");
    });
  });

  describe("#currentOptionExpiry", () => {
    it("should return 0 when currentOption not set", async function () {
      assert.equal((await this.vault.currentOptionExpiry()).toString(), "0");
    });
  });

  describe("#decimals", () => {
    it("should return 18 for decimals", async function () {
      assert.equal((await this.vault.decimals()).toString(), "18");
    });
  });
});

async function signOrderForSwap({
  vaultAddress,
  counterpartyAddress,
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  signerPrivateKey,
}) {
  let order = createOrder({
    signer: {
      wallet: vaultAddress,
      token: sellToken,
      amount: sellAmount,
    },
    sender: {
      wallet: counterpartyAddress,
      token: buyToken,
      amount: buyAmount,
    },
    affiliate: {
      wallet: TRADER_AFFILIATE,
    },
  });

  const signedOrder = await signTypedDataOrder(
    order,
    signerPrivateKey,
    SWAP_CONTRACT
  );
  return signedOrder;
}
