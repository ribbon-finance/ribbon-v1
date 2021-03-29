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
  whitelistProduct,
  parseLog,
} = require("./helpers/utils");
const moment = require("moment");

let owner, user, feeRecipient;
let userSigner, ownerSigner, managerSigner, counterpartySigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const SWAP_ADDRESS = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";
const SWAP_CONTRACT = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";
const TRADER_AFFILIATE = "0xFf98F0052BdA391F8FaD266685609ffb192Bef25";

const OPTION_DELAY = 60 * 60 * 24; // 1 day
const LOCKED_RATIO = parseEther("0.9");
const WITHDRAWAL_BUFFER = parseEther("1").sub(LOCKED_RATIO);
const gasPrice = parseUnits("1", "gwei");

describe("RibbonCoveredCall", () => {
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

    const initializeTypes = ["address", "address", "address", "uint256"];
    const initializeArgs = [
      WETH_ADDRESS,
      owner,
      feeRecipient,
      parseEther("500"),
    ];
    const deployArgs = [
      factory.address,
      WETH_ADDRESS,
      USDC_ADDRESS,
      SWAP_ADDRESS,
    ];

    this.vault = (
      await deployProxy(
        "RibbonCoveredCall",
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

    this.asset = WETH_ADDRESS;

    this.oTokenAddress = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

    this.oToken = await getContractAt("IERC20", this.oTokenAddress);

    this.oTokenFactory = await getContractAt("IOtokenFactory", OTOKEN_FACTORY);

    this.weth = await getContractAt("IWETH", WETH_ADDRESS);

    this.airswap = await getContractAt("ISwap", SWAP_ADDRESS);

    this.rollToNextOption = async () => {
      await this.vault.connect(managerSigner).setNextOption(this.optionTerms);
      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );
      await this.vault.connect(managerSigner).rollToNextOption();
    };
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("constructor", () => {
    time.revertToSnapshotAfterEach();

    it("reverts when deployed with 0x0 factory", async function () {
      const VaultContract = await ethers.getContractFactory(
        "RibbonCoveredCall",
        {
          libraries: {
            ProtocolAdapter: this.protocolAdapterLib.address,
          },
        }
      );
      await expect(
        VaultContract.deploy(
          constants.AddressZero,
          WETH_ADDRESS,
          USDC_ADDRESS,
          SWAP_ADDRESS
        )
      ).to.be.revertedWith("!_factory");
    });

    it("reverts when adapter not set yet", async function () {
      const VaultContract = await ethers.getContractFactory(
        "RibbonCoveredCall",
        {
          libraries: {
            ProtocolAdapter: this.protocolAdapterLib.address,
          },
        }
      );

      await this.factory.setAdapter("OPYN_GAMMA", constants.AddressZero);

      await expect(
        VaultContract.deploy(
          this.factory.address,
          WETH_ADDRESS,
          USDC_ADDRESS,
          SWAP_ADDRESS
        )
      ).to.be.revertedWith("Adapter not set");
    });
  });

  describe("#initialize", () => {
    time.revertToSnapshotAfterEach(async function () {
      const RibbonCoveredCall = await ethers.getContractFactory(
        "RibbonCoveredCall",
        {
          libraries: {
            ProtocolAdapter: this.protocolAdapterLib.address,
          },
        }
      );
      this.testVault = await RibbonCoveredCall.deploy(
        this.factory.address,
        WETH_ADDRESS,
        USDC_ADDRESS,
        SWAP_ADDRESS
      );
    });

    it("initializes with correct values", async function () {
      assert.equal((await this.vault.cap()).toString(), parseEther("500"));
      assert.equal(await this.vault.factory(), this.factory.address);
      assert.equal(await this.vault.owner(), owner);
      assert.equal(await this.vault.feeRecipient(), feeRecipient);
      assert.equal(await this.vault.asset(), this.asset);
      assert.equal(
        (await this.vault.instantWithdrawalFee()).toString(),
        parseEther("0.005").toString()
      );
    });

    it("cannot be initialized twice", async function () {
      await expect(
        this.vault.initialize(
          WETH_ADDRESS,
          owner,
          feeRecipient,
          parseEther("500")
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("reverts when initializing with 0 owner", async function () {
      await expect(
        this.testVault.initialize(
          WETH_ADDRESS,
          constants.AddressZero,
          feeRecipient,
          parseEther("500")
        )
      ).to.be.revertedWith("!_owner");
    });

    it("reverts when initializing with 0 feeRecipient", async function () {
      await expect(
        this.testVault.initialize(
          WETH_ADDRESS,
          owner,
          constants.AddressZero,
          parseEther("500")
        )
      ).to.be.revertedWith("!_feeRecipient");
    });

    it("reverts when initializing with 0 asset", async function () {
      await expect(
        this.testVault.initialize(
          constants.AddressZero,
          owner,
          feeRecipient,
          parseEther("500")
        )
      ).to.be.revertedWith("!_asset");
    });

    it("reverts when initializing with 0 initCap", async function () {
      await expect(
        this.testVault.initialize(WETH_ADDRESS, owner, feeRecipient, "0")
      ).to.be.revertedWith("_initCap > 0");
    });
  });

  describe("#name", () => {
    it("returns the name", async function () {
      assert.equal(await this.vault.name(), "Ribbon ETH Theta Vault");
    });
  });

  describe("#symbol", () => {
    it("returns the symbol", async function () {
      assert.equal(await this.vault.symbol(), "rETH-THETA");
    });
  });

  describe("#asset", () => {
    it("returns the asset", async function () {
      assert.equal(await this.vault.asset(), WETH_ADDRESS);
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
      ).to.be.revertedWith("!newManager");
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

  describe("#setFeeRecipient", () => {
    time.revertToSnapshotAfterTest();

    it("reverts when setting 0x0 as feeRecipient", async function () {
      await expect(
        this.vault.connect(ownerSigner).setManager(constants.AddressZero)
      ).to.be.revertedWith("!newManager");
    });

    it("reverts when not owner call", async function () {
      await expect(this.vault.setFeeRecipient(manager)).to.be.revertedWith(
        "caller is not the owner"
      );
    });

    it("changes the fee recipient", async function () {
      await this.vault.connect(ownerSigner).setFeeRecipient(manager);
      assert.equal(await this.vault.feeRecipient(), manager);
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
      await expect(res)
        .to.emit(this.vault, "Deposit")
        .withArgs(user, depositAmount, depositAmount);
    });

    it("consumes less than 100k gas in ideal scenario", async function () {
      await this.vault
        .connect(managerSigner)
        .depositETH({ value: parseEther("0.1") });

      const res = await this.vault.depositETH({ value: parseEther("0.1") });
      const receipt = await res.wait();
      console.log(receipt.gasUsed.toNumber());
      assert.isAtMost(receipt.gasUsed.toNumber(), 100000);
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
      await expect(res)
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

      await this.rollToNextOption();

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

  describe("#setNextOption", () => {
    time.revertToSnapshotAfterEach();

    it("reverts when not called with manager", async function () {
      await expect(
        this.vault
          .connect(userSigner)
          .setNextOption(this.optionTerms, { from: user })
      ).to.be.revertedWith("Only manager");
    });

    it("reverts when option is 0x0", async function () {
      const optionTerms = [
        WETH_ADDRESS,
        USDC_ADDRESS,
        WETH_ADDRESS,
        "1610697601",
        parseEther("1480"),
        2,
        WETH_ADDRESS,
      ];

      await expect(
        this.vault.connect(managerSigner).setNextOption(optionTerms)
      ).to.be.revertedWith("!option");
    });

    it("reverts when otoken underlying is different from asset", async function () {
      await whitelistProduct(WBTC_ADDRESS, USDC_ADDRESS, WBTC_ADDRESS, false);

      const underlying = WBTC_ADDRESS;
      const strike = USDC_ADDRESS;
      const strikePrice = parseEther("50000");
      const expiry = "1614326400";
      const isPut = false;

      await this.oTokenFactory.createOtoken(
        underlying,
        strike,
        underlying,
        strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
        expiry,
        isPut
      );

      const optionTerms = [
        underlying,
        strike,
        underlying,
        expiry,
        strikePrice,
        2,
        USDC_ADDRESS,
      ];

      await expect(
        this.vault.connect(managerSigner).setNextOption(optionTerms)
      ).to.be.revertedWith("!asset");
    });

    it("reverts when the strike is not USDC", async function () {
      const underlying = WETH_ADDRESS;
      const strike = WBTC_ADDRESS;
      const strikePrice = parseEther("50000");
      const expiry = "1614326400";
      const isPut = false;

      await whitelistProduct(underlying, strike, underlying, false);

      await this.oTokenFactory.createOtoken(
        underlying,
        strike,
        underlying,
        strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
        expiry,
        isPut
      );

      const optionTerms = [
        underlying,
        strike,
        underlying,
        expiry,
        strikePrice,
        2,
        USDC_ADDRESS,
      ];

      await expect(
        this.vault.connect(managerSigner).setNextOption(optionTerms)
      ).to.be.revertedWith("strikeAsset != USDC");
    });

    it("reverts when the expiry is before the delay", async function () {
      const block = await provider.getBlock();

      const underlying = WETH_ADDRESS;
      const strike = USDC_ADDRESS;
      const strikePrice = parseEther("1480");
      const isPut = false;

      let expiryDate;

      const currentBlock = moment.utc(block.timestamp * 1000);

      // get the same day's 8am
      const sameDay8AM = moment
        .utc()
        .year(currentBlock.year())
        .month(currentBlock.month())
        .date(currentBlock.date())
        .hour(8)
        .minute(0)
        .second(0)
        .millisecond(0);

      if (currentBlock.isBefore(sameDay8AM)) {
        expiryDate = sameDay8AM;
      } else {
        // use next day's 8am
        expiryDate = sameDay8AM.add(1, "day");
      }
      const expiry = Math.round(expiryDate.valueOf() / 1000);

      await this.oTokenFactory.createOtoken(
        underlying,
        strike,
        underlying,
        strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
        expiry,
        isPut
      );

      const optionTerms = [
        underlying,
        strike,
        underlying,
        expiry,
        strikePrice,
        2,
        USDC_ADDRESS,
      ];

      await expect(
        this.vault.connect(managerSigner).setNextOption(optionTerms)
      ).to.be.revertedWith("Option expiry cannot be before delay");
    });

    it("sets the next option", async function () {
      const res = await this.vault
        .connect(managerSigner)
        .setNextOption(this.optionTerms, { from: manager });

      const receipt = await res.wait();
      const block = await provider.getBlock(receipt.blockNumber);

      assert.equal(await this.vault.nextOption(), this.oTokenAddress);
      assert.equal(
        (await this.vault.nextOptionReadyAt()).toNumber(),
        parseInt(block.timestamp) + OPTION_DELAY
      );
    });

    it("should set the next option twice", async function () {
      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1610697600",
          parseEther("1480"),
          2,
          WETH_ADDRESS,
        ]);

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1614326400",
          parseEther("960"),
          2,
          WETH_ADDRESS,
        ]);
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
        this.vault.connect(userSigner).rollToNextOption()
      ).to.be.revertedWith("Only manager");
    });

    it("reverts when delay not passed", async function () {
      await this.vault.connect(managerSigner).setNextOption(this.optionTerms);

      // will revert when trying to roll immediately
      await expect(
        this.vault.connect(managerSigner).rollToNextOption()
      ).to.be.revertedWith("Delay not passed");
    });

    it("mints oTokens and deposits collateral into vault", async function () {
      const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO);
      const availableAmount = wmul(
        this.depositAmount,
        parseEther("1").sub(LOCKED_RATIO)
      );

      const startMarginBalance = await this.weth.balanceOf(MARGIN_POOL);

      await this.vault.connect(managerSigner).setNextOption(this.optionTerms);

      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const res = this.vault.connect(managerSigner).rollToNextOption();

      await expect(res).to.not.emit(this.vault, "CloseShort");

      await expect(res)
        .to.emit(this.vault, "OpenShort")
        .withArgs(this.oTokenAddress, lockedAmount, manager);

      assert.equal((await this.vault.lockedAmount()).toString(), lockedAmount);

      assert.equal(
        (await this.vault.assetBalance()).toString(),
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

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1610697600",
          parseEther("1480"),
          2,
          WETH_ADDRESS,
        ]);

      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const firstTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption();

      await expect(firstTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(firstOption, wmul(this.depositAmount, LOCKED_RATIO), manager);

      // 90% of the vault's balance is allocated to short
      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        parseEther("0.1").toString()
      );

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1614326400",
          parseEther("960"),
          2,
          WETH_ADDRESS,
        ]);

      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const secondTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption();

      assert.equal(await this.vault.currentOption(), secondOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1614326400);

      // Withdraw the original short position, which is 90% of the vault
      await expect(secondTx)
        .to.emit(this.vault, "CloseShort")
        .withArgs(firstOption, parseEther("0.9"), manager);

      await expect(secondTx)
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

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1610697600",
          parseEther("1480"),
          2,
          WETH_ADDRESS,
        ]);

      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      await this.vault.connect(managerSigner).rollToNextOption();

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

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1614326400",
          parseEther("960"),
          2,
          WETH_ADDRESS,
        ]);
      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      await expect(
        this.vault.connect(managerSigner).rollToNextOption()
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("withdraws and roll funds into next option, after expiry ITM", async function () {
      const firstOption = "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3";
      const secondOption = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1610697600",
          parseEther("1480"),
          2,
          WETH_ADDRESS,
        ]);
      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const firstTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption();

      assert.equal(await this.vault.currentOption(), firstOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1610697600);

      await expect(firstTx)
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

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1614326400",
          parseEther("960"),
          2,
          WETH_ADDRESS,
        ]);
      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const secondTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption();

      assert.equal(await this.vault.currentOption(), secondOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1614326400);

      await expect(secondTx)
        .to.emit(this.vault, "CloseShort")
        .withArgs(firstOption, wmul(this.depositAmount, LOCKED_RATIO), manager);

      await expect(secondTx)
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

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1610697600",
          parseEther("1480"),
          2,
          WETH_ADDRESS,
        ]);
      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const firstTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption();

      await expect(firstTx)
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

      await this.vault
        .connect(managerSigner)
        .setNextOption([
          WETH_ADDRESS,
          USDC_ADDRESS,
          WETH_ADDRESS,
          "1614326400",
          parseEther("960"),
          2,
          WETH_ADDRESS,
        ]);
      await time.increaseTo(
        (await this.vault.nextOptionReadyAt()).toNumber() + 1
      );

      const secondTx = await this.vault
        .connect(managerSigner)
        .rollToNextOption();

      assert.equal(await this.vault.currentOption(), secondOption);
      assert.equal(await this.vault.currentOptionExpiry(), 1614326400);

      await expect(secondTx)
        .to.emit(this.vault, "CloseShort")
        .withArgs(firstOption, parseEther("0.8325"), manager);

      await expect(secondTx)
        .to.emit(this.vault, "OpenShort")
        .withArgs(secondOption, parseEther("0.92925"), manager);

      assert.equal(
        (await this.weth.balanceOf(this.vault.address)).toString(),
        parseEther("0.10325")
      );
    });
  });

  describe("#emergencyWithdrawFromShort", () => {
    time.revertToSnapshotAfterTest();

    it("reverts when not allocated to a short", async function () {
      await expect(
        this.vault.connect(managerSigner).emergencyWithdrawFromShort()
      ).to.be.revertedWith("!currentOption");

      // doesn't matter if the nextOption is set
      await this.vault.connect(managerSigner).setNextOption(this.optionTerms);

      await expect(
        this.vault.connect(managerSigner).emergencyWithdrawFromShort()
      ).to.be.revertedWith("!currentOption");
    });

    it("withdraws locked funds by closing short", async function () {
      await this.vault.depositETH({ value: parseEther("1") });
      await this.rollToNextOption();
      assert.equal(
        (await this.vault.assetBalance()).toString(),
        parseEther("0.1")
      );
      // this assumes that we found a way to get back the otokens
      await this.vault.connect(managerSigner).emergencyWithdrawFromShort();
      assert.equal(
        (await this.vault.assetBalance()).toString(),
        parseEther("1")
      );
      assert.equal(
        (await this.oToken.balanceOf(this.vault.address)).toString(),
        "0"
      );
      assert.equal(await this.vault.currentOption(), constants.AddressZero);
      assert.equal(await this.vault.nextOption(), constants.AddressZero);
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

      await this.rollToNextOption();
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

      await expect(res)
        .to.emit(this.oToken, "Transfer")
        .withArgs(this.vault.address, counterparty, this.sellAmount);

      const wethERC20 = await getContractAt("IERC20", this.weth.address);

      await expect(res)
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

  describe("#assetBalance", () => {
    time.revertToSnapshotAfterEach(async function () {
      this.depositAmount = parseEther("1");

      await this.vault.depositETH({ value: this.depositAmount });

      assert.equal(
        (await this.vault.totalSupply()).toString(),
        this.depositAmount
      );

      await this.rollToNextOption();
    });

    it("returns the free balance, after locking", async function () {
      assert.equal(
        (await this.vault.assetBalance()).toString(),
        wmul(this.depositAmount, parseEther("0.1")).toString()
      );
    });

    it("returns the free balance - locked, if free > locked", async function () {
      await this.vault.depositETH({ value: parseEther("10") });

      const freeAmount = parseEther("10").add(
        wmul(this.depositAmount, parseEther("0.1"))
      );

      assert.equal((await this.vault.assetBalance()).toString(), freeAmount);
    });
  });

  describe("#withdrawETH", () => {
    time.revertToSnapshotAfterEach();

    it("reverts when withdrawing more than balance", async function () {
      await this.vault.depositETH({ value: parseEther("10") });

      await this.rollToNextOption();

      await expect(this.vault.withdrawETH(parseEther("2"))).to.be.revertedWith(
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
        parseEther("0.0005").toString()
      );

      assert.equal(
        (await provider.getBalance(user))
          .add(gasFee)
          .sub(startETHBalance)
          .toString(),
        parseEther("0.0995").toString()
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

      await expect(res)
        .to.emit(this.vault, "Withdraw")
        .withArgs(
          user,
          parseEther("0.0995"),
          parseEther("0.1"),
          parseEther("0.0005")
        );
    });

    it("should withdraw funds up to 10% of pool", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      // simulate the vault accumulating more WETH
      await this.weth.connect(userSigner).deposit({ value: parseEther("1") });
      await this.weth
        .connect(userSigner)
        .transfer(this.vault.address, parseEther("1"));

      assert.equal(
        (await this.vault.assetBalance()).toString(),
        parseEther("2").toString()
      );

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
        parseEther("0.995").toString()
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
        BigNumber.from("1899545454545454545")
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

    it("should be able to withdraw everything from the vault", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      // simulate setting a bad otoken
      await this.vault.connect(managerSigner).setNextOption(this.optionTerms);

      // users should have time to withdraw
      await this.vault.withdrawETH(parseEther("1"));
    });
  });

  describe("#withdrawAmountWithShares", () => {
    time.revertToSnapshotAfterEach();

    it("returns the correct withdrawal amount", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      const [
        withdrawAmount,
        feeAmount,
      ] = await this.vault.withdrawAmountWithShares(parseEther("0.1"));

      assert.equal(withdrawAmount.toString(), parseEther("0.0995"));
      assert.equal(feeAmount.toString(), parseEther("0.0005"));

      await this.vault.withdraw(parseEther("0.1"));

      assert.equal(
        (await this.weth.balanceOf(user)).toString(),
        withdrawAmount
      );
    });
  });

  describe("#maxWithdrawAmount", () => {
    time.revertToSnapshotAfterEach();

    it("returns the max withdrawable amount when the withdrawal amount is more than available", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      assert.equal(
        (await this.vault.maxWithdrawAmount(user)).toString(),
        parseEther("0.995")
      );
    });

    it("returns the max withdrawable amount", async function () {
      await this.vault
        .connect(managerSigner)
        .depositETH({ value: parseEther("9") });
      await this.vault.depositETH({ value: parseEther("1") });

      assert.equal(
        (await this.vault.maxWithdrawAmount(user)).toString(),
        parseEther("0.995")
      );
    });
  });

  describe("#maxWithdrawableShares", () => {
    time.revertToSnapshotAfterEach();

    it("returns the max shares withdrawable of the system", async function () {
      await this.vault.depositETH({ value: parseEther("1") });

      assert.equal(
        (await this.vault.maxWithdrawableShares()).toString(),
        parseEther("1").toString()
      );
    });
  });

  describe("#withdraw", () => {
    time.revertToSnapshotAfterEach();

    it("should withdraw funds, sending withdrawal fee to feeRecipient", async function () {
      await this.vault.depositETH({ value: parseEther("1") });
      await this.vault.withdraw(parseEther("0.1"));
      assert.equal(
        (await this.weth.balanceOf(user)).toString(),
        parseEther("0.0995")
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

  describe("#setWithdrawalFee", () => {
    it("reverts when not manager", async function () {
      await expect(
        this.vault.connect(userSigner).setWithdrawalFee(parseEther("0.1"))
      ).to.be.revertedWith("Only manager");
    });

    it("reverts when withdrawal fee is 0", async function () {
      await expect(
        this.vault.connect(managerSigner).setWithdrawalFee(0)
      ).to.be.revertedWith("withdrawalFee != 0");
    });

    it("reverts when withdrawal fee set to 100%", async function () {
      await expect(
        this.vault.connect(managerSigner).setWithdrawalFee(parseEther("100"))
      ).to.be.revertedWith("withdrawalFee >= 100%");
    });

    it("sets the withdrawal fee", async function () {
      const res = await this.vault
        .connect(managerSigner)
        .setWithdrawalFee(parseEther("0.1"));

      await expect(res)
        .to.emit(this.vault, "WithdrawalFeeSet")
        .withArgs(parseEther("0.005"), parseEther("0.1"));

      assert.equal(
        (await this.vault.instantWithdrawalFee()).toString(),
        parseEther("0.1").toString()
      );
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
