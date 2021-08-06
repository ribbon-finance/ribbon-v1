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
  mintToken,
} = require("./helpers/utils");
const moment = require("moment-timezone");
moment.tz.setDefault("UTC");

let owner, user, manager, counterparty, feeRecipient;
let adminSigner,
  userSigner,
  ownerSigner,
  managerSigner,
  counterpartySigner,
  feeRecipientSigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_OWNER_ADDRESS = "0xCA06411bd7a7296d7dbdd0050DFc846E95fEBEB7";
const USDC_OWNER_ADDRESS = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503";

const CHAINLINK_WETH_PRICER = "0xAC05f5147566Cc949b73F0A776944E7011FabC50";
const CHAINLINK_WBTC_PRICER = "0x5faCA6DF39c897802d752DfCb8c02Ea6959245Fc";

const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const SWAP_ADDRESS = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";
const SWAP_CONTRACT = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";
const TRADER_AFFILIATE = "0xFf98F0052BdA391F8FaD266685609ffb192Bef25";

const OPTION_DELAY = 60 * 60; // 1 hour
const LOCKED_RATIO = parseEther("0.9");
const WITHDRAWAL_BUFFER = parseEther("1").sub(LOCKED_RATIO);
const gasPrice = parseUnits("1", "gwei");

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("RibbonThetaVault", () => {
  behavesLikeRibbonOptionsVault({
    name: `Ribbon WBTC Theta Vault (Call)`,
    tokenName: "Ribbon BTC Theta Vault",
    tokenSymbol: "rWBTC-THETA",
    asset: WBTC_ADDRESS,
    assetContractName: "IWBTC",
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WBTC_ADDRESS,
    wrongUnderlyingAsset: WETH_ADDRESS,
    wrongStrikeAsset: WETH_ADDRESS,
    firstOptionStrike: 2400,
    secondOptionStrike: 2500,
    chainlinkPricer: CHAINLINK_WBTC_PRICER,
    tokenDecimals: 18,
    depositAmount: BigNumber.from("100000000"),
    premium: BigNumber.from("10000000"),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    expectedMintAmount: BigNumber.from("90000000"),
    isPut: false,
    mintConfig: {
      contractOwnerAddress: WBTC_OWNER_ADDRESS,
    },
  });

  behavesLikeRibbonOptionsVault({
    name: `Ribbon ETH Theta Vault (Call)`,
    tokenName: "Ribbon ETH Theta Vault",
    tokenSymbol: "rETH-THETA",
    asset: WETH_ADDRESS,
    assetContractName: "IWETH",
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    wrongUnderlyingAsset: WBTC_ADDRESS,
    wrongStrikeAsset: WBTC_ADDRESS,
    firstOptionStrike: 63000,
    secondOptionStrike: 64000,
    chainlinkPricer: CHAINLINK_WETH_PRICER,
    depositAmount: parseEther("1"),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    expectedMintAmount: BigNumber.from("90000000"),
    premium: parseEther("0.1"),
    tokenDecimals: 8,
    isPut: false,
  });

  behavesLikeRibbonOptionsVault({
    name: `Ribbon WBTC Theta Vault (Put)`,
    tokenName: "Ribbon BTC Theta Vault Put",
    tokenSymbol: "rWBTC-THETA-P",
    asset: WBTC_ADDRESS,
    assetContractName: "IUSDC",
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    wrongUnderlyingAsset: WETH_ADDRESS,
    wrongStrikeAsset: WETH_ADDRESS,
    firstOptionStrike: 2400,
    secondOptionStrike: 2500,
    chainlinkPricer: CHAINLINK_WBTC_PRICER,
    tokenDecimals: 18,
    depositAmount: BigNumber.from("100000000"),
    premium: BigNumber.from("10000000"),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    expectedMintAmount: BigNumber.from("3600000"),
    isPut: true,
    mintConfig: {
      contractOwnerAddress: USDC_OWNER_ADDRESS,
    },
  });

  behavesLikeRibbonOptionsVault({
    name: `Ribbon ETH Theta Vault (Put) `,
    tokenName: "Ribbon ETH Theta Vault Put",
    tokenSymbol: "rETH-THETA-P",
    asset: WETH_ADDRESS,
    assetContractName: "IUSDC",
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    wrongUnderlyingAsset: WBTC_ADDRESS,
    wrongStrikeAsset: WBTC_ADDRESS,
    firstOptionStrike: 63000,
    secondOptionStrike: 64000,
    chainlinkPricer: CHAINLINK_WETH_PRICER,
    depositAmount: BigNumber.from("100000000000"),
    premium: BigNumber.from("10000000000"),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    expectedMintAmount: BigNumber.from("140625000"),
    tokenDecimals: 8,
    isPut: true,
    mintConfig: {
      contractOwnerAddress: USDC_OWNER_ADDRESS,
    },
  });
});

/**
 *
 * @param {Object} params - Parameter of option vault
 * @param {string} params.name - Name of test
 * @param {string} params.tokenName - Name of Option Vault
 * @param {string} params.tokenSymbol - Symbol of Option Vault
 * @param {number} params.tokenDecimals - Decimals of the vault shares
 * @param {string} params.asset - Address of assets
 * @param {string} params.assetContractName - Name of collateral asset contract
 * @param {string} params.strikeAsset - Address of strike assets
 * @param {string} params.collateralAsset - Address of asset used for collateral
 * @param {string} params.wrongUnderlyingAsset - Address of wrong underlying assets
 * @param {string} params.wrongStrikeAsset - Address of wrong strike assets
 * @param {number} params.firstOptionStrike - Strike price of first option
 * @param {number} params.secondOptionStrike - Strike price of second option
 * @param {string} params.chainlinkPricer - Address of chainlink pricer
 * @param {Object=} params.mintConfig - Optional: For minting asset, if asset can be minted
 * @param {string} params.mintConfig.contractOwnerAddress - Impersonate address of mintable asset contract owner
 * @param {BigNumber} params.depositAmount - Deposit amount
 * @param {string} params.minimumSupply - Minimum supply to maintain for share and asset balance
 * @param {BigNumber} params.expectedMintAmount - Expected oToken amount to be minted with our deposit
 * @param {BigNumber} params.premium - Minimum supply to maintain for share and asset balance
 * @param {boolean} params.isPut - Boolean flag for if the vault sells call or put options
 */
function behavesLikeRibbonOptionsVault(params) {
  describe(`${params.name}`, () => {
    let initSnapshotId;
    let firstOption;
    let secondOption;

    before(async function () {
      // Reset block
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.TEST_URI,
              blockNumber: 12238727,
            },
          },
        ],
      });

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
      this.tokenName = params.tokenName;
      this.tokenSymbol = params.tokenSymbol;
      this.tokenDecimals = params.tokenDecimals;
      this.minimumSupply = params.minimumSupply;
      this.asset = params.asset;
      this.collateralAsset = params.collateralAsset;
      this.optionType = params.isPut ? PUT_OPTION_TYPE : CALL_OPTION_TYPE;
      this.depositAmount = params.depositAmount;
      this.premium = params.premium;
      this.expectedMintAmount = params.expectedMintAmount;
      this.isPut = params.isPut;

      this.counterpartyWallet = ethers.Wallet.fromMnemonic(
        process.env.TEST_MNEMONIC,
        "m/44'/60'/0'/0/4"
      );

      const {
        factory,
        registry,
        protocolAdapterLib,
        gammaAdapter,
      } = await getDefaultArgs();
      await factory.setAdapter("OPYN_GAMMA", gammaAdapter.address);

      this.factory = factory;
      this.registry = registry;
      this.protocolAdapterLib = protocolAdapterLib;

      const initializeTypes = [
        "address",
        "address",
        "uint256",
        "string",
        "string",
      ];
      const initializeArgs = [
        owner,
        feeRecipient,
        parseEther("500"),
        this.tokenName,
        this.tokenSymbol,
      ];
      const deployArgs = [
        this.asset,
        factory.address,
        this.registry.address,
        WETH_ADDRESS,
        params.strikeAsset,
        SWAP_ADDRESS,
        this.tokenDecimals,
        this.minimumSupply,
        this.isPut,
      ];

      this.vault = (
        await deployProxy(
          "RibbonThetaVault",
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

      this.spareVault = (
        await deployProxy(
          "RibbonThetaVault",
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

      const mockV2Factory = await ethers.getContractFactory(
        "MockRibbonV2Vault"
      );

      const v2contract = await mockV2Factory.deploy(this.collateralAsset);
      this.v2vault = await ethers.getContractAt(
        "MockRibbonV2Vault",
        v2contract.address
      );

      await this.vault.connect(ownerSigner).setFeeRecipient(this.vault.address);
      feeRecipient = this.vault.address;

      await this.vault.connect(ownerSigner).setManager(manager);

      this.oTokenFactory = await getContractAt(
        "IOtokenFactory",
        OTOKEN_FACTORY
      );

      await whitelistProduct(
        params.asset,
        params.strikeAsset,
        params.collateralAsset,
        params.isPut
      );

      // Create first option
      let res = await this.oTokenFactory.createOtoken(
        params.asset,
        params.strikeAsset,
        params.collateralAsset,
        parseEther(params.firstOptionStrike.toString()).div(
          BigNumber.from("10").pow(BigNumber.from("10"))
        ),
        moment().add(7, "days").hours(8).minutes(0).seconds(0).unix(),
        params.isPut
      );
      let receipt = await res.wait();
      let events = await parseLog("IOtokenFactory", receipt.logs[1]);

      firstOption = {
        address: events.args.tokenAddress,
        expiry: events.args.expiry.toNumber(),
      };

      // Create second option
      res = await this.oTokenFactory.createOtoken(
        params.asset,
        params.strikeAsset,
        params.collateralAsset,
        parseEther(params.secondOptionStrike.toString()).div(
          BigNumber.from("10").pow(BigNumber.from("10"))
        ),
        moment().add(14, "days").hours(8).minutes(0).seconds(0).unix(),
        params.isPut
      );
      receipt = await res.wait();
      events = await parseLog("IOtokenFactory", receipt.logs[1]);

      secondOption = {
        address: events.args.tokenAddress,
        expiry: events.args.expiry.toNumber(),
      };

      this.optionTerms = [
        params.asset,
        params.strikeAsset,
        params.collateralAsset,
        secondOption.expiry.toString(),
        parseEther(params.secondOptionStrike.toString()),
        this.optionType,
        params.collateralAsset,
      ];

      this.asset = params.asset;

      this.oTokenAddress = secondOption.address;

      this.oToken = await getContractAt("IERC20", this.oTokenAddress);

      this.assetContract = await getContractAt(
        params.assetContractName,
        this.collateralAsset
      );

      this.airswap = await getContractAt("ISwap", SWAP_ADDRESS);

      // If mintable token, then mine the token
      if (params.mintConfig) {
        const addressToDeposit = [
          userSigner,
          managerSigner,
          counterpartySigner,
          adminSigner,
        ];

        for (let i = 0; i < addressToDeposit.length; i++) {
          await mintToken(
            this.assetContract,
            params.mintConfig.contractOwnerAddress,
            addressToDeposit[i],
            this.vault.address,
            params.collateralAsset == USDC_ADDRESS
              ? BigNumber.from("10000000000000")
              : parseEther("200")
          );
        }
      }

      this.rollToNextOption = async () => {
        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);
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
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );
        await expect(
          VaultContract.deploy(
            this.asset,
            constants.AddressZero,
            this.registry.address,
            WETH_ADDRESS,
            params.strikeAsset,
            SWAP_ADDRESS,
            this.tokenDecimals,
            this.minimumSupply,
            this.isPut
          )
        ).to.be.revertedWith("!_factory");
      });

      it("reverts when adapter not set yet", async function () {
        const Factory = await ethers.getContractFactory("RibbonFactory");
        const factory = await Factory.deploy();

        const VaultContract = await ethers.getContractFactory(
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );

        await expect(
          VaultContract.deploy(
            this.asset,
            factory.address,
            this.registry.address,
            WETH_ADDRESS,
            params.strikeAsset,
            SWAP_ADDRESS,
            this.tokenDecimals,
            this.minimumSupply,
            this.isPut
          )
        ).to.be.revertedWith("Adapter not set");
      });

      it("reverts when asset is 0x", async function () {
        const VaultContract = await ethers.getContractFactory(
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );

        await expect(
          VaultContract.deploy(
            constants.AddressZero,
            this.factory.address,
            this.registry.address,
            WETH_ADDRESS,
            params.strikeAsset,
            SWAP_ADDRESS,
            this.tokenDecimals,
            this.minimumSupply,
            this.isPut
          )
        ).to.be.revertedWith("!_asset");
      });

      it("reverts when decimals is 0", async function () {
        const VaultContract = await ethers.getContractFactory(
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );

        await expect(
          VaultContract.deploy(
            this.asset,
            this.factory.address,
            this.registry.address,
            WETH_ADDRESS,
            params.strikeAsset,
            SWAP_ADDRESS,
            0,
            this.minimumSupply,
            this.isPut
          )
        ).to.be.revertedWith("!_tokenDecimals");
      });

      it("reverts when minimumSupply is 0", async function () {
        const VaultContract = await ethers.getContractFactory(
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );

        await expect(
          VaultContract.deploy(
            this.asset,
            this.factory.address,
            this.registry.address,
            WETH_ADDRESS,
            params.strikeAsset,
            SWAP_ADDRESS,
            this.tokenDecimals,
            0,
            this.isPut
          )
        ).to.be.revertedWith("!_minimumSupply");
      });

      it("sets the correct asset, decimals and minimum supply", async function () {
        const VaultContract = await ethers.getContractFactory(
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );

        const asset = params.asset;
        const collateralAsset = params.collateralAsset;
        const decimals = 6;
        const minSupply = BigNumber.from("10").pow("6").toString();

        const vault = await VaultContract.deploy(
          asset,
          this.factory.address,
          this.registry.address,
          WETH_ADDRESS,
          params.strikeAsset,
          SWAP_ADDRESS,
          decimals,
          minSupply,
          this.isPut
        );
        assert.equal(await vault.decimals(), decimals);
        assert.equal(await vault.asset(), collateralAsset);
        assert.equal(await vault.MINIMUM_SUPPLY(), minSupply);
      });
    });

    describe("#initialize", () => {
      time.revertToSnapshotAfterEach(async function () {
        const RibbonThetaVault = await ethers.getContractFactory(
          "RibbonThetaVault",
          {
            libraries: {
              ProtocolAdapter: this.protocolAdapterLib.address,
            },
          }
        );
        this.testVault = await RibbonThetaVault.deploy(
          this.asset,
          this.factory.address,
          this.registry.address,
          WETH_ADDRESS,
          params.strikeAsset,
          SWAP_ADDRESS,
          this.tokenDecimals,
          this.minimumSupply,
          this.isPut
        );
      });

      it("initializes with correct values", async function () {
        assert.equal((await this.vault.cap()).toString(), parseEther("500"));
        assert.equal(await this.vault.owner(), owner);
        assert.equal(await this.vault.feeRecipient(), feeRecipient);
        assert.equal(await this.vault.asset(), this.collateralAsset);
        assert.equal(
          (await this.vault.instantWithdrawalFee()).toString(),
          parseEther("0.005").toString()
        );
        assert.equal(await this.vault.SWAP_CONTRACT(), SWAP_ADDRESS);
        assert.equal(await this.vault.WETH(), WETH_ADDRESS);
        assert.equal(await this.vault.USDC(), USDC_ADDRESS);
      });

      it("cannot be initialized twice", async function () {
        await expect(
          this.vault.initialize(
            owner,
            feeRecipient,
            parseEther("500"),
            this.tokenName,
            this.tokenSymbol
          )
        ).to.be.revertedWith("Initializable: contract is already initialized");
      });

      it("reverts when initializing with 0 owner", async function () {
        await expect(
          this.testVault.initialize(
            constants.AddressZero,
            feeRecipient,
            parseEther("500"),
            this.tokenName,
            this.tokenSymbol
          )
        ).to.be.revertedWith("!_owner");
      });

      it("reverts when initializing with 0 feeRecipient", async function () {
        await expect(
          this.testVault.initialize(
            owner,
            constants.AddressZero,
            parseEther("500"),
            this.tokenName,
            this.tokenSymbol
          )
        ).to.be.revertedWith("!_feeRecipient");
      });

      it("reverts when initializing with 0 initCap", async function () {
        await expect(
          this.testVault.initialize(
            owner,
            feeRecipient,
            "0",
            this.tokenName,
            this.tokenSymbol
          )
        ).to.be.revertedWith("_initCap > 0");
      });
    });

    describe("#name", () => {
      it("returns the name", async function () {
        assert.equal(await this.vault.name(), this.tokenName);
      });
    });

    describe("#symbol", () => {
      it("returns the symbol", async function () {
        assert.equal(await this.vault.symbol(), this.tokenSymbol);
      });
    });

    describe("#isPut", () => {
      it("returns the correct option type", async function () {
        assert.equal(await this.vault.isPut(), this.isPut);
      });
    });

    describe("#delay", () => {
      it("returns the delay", async function () {
        assert.equal((await this.vault.delay()).toNumber(), OPTION_DELAY);
      });
    });

    describe("#asset", () => {
      it("returns the asset", async function () {
        assert.equal(await this.vault.asset(), this.collateralAsset);
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
        assert.isFalse(
          await this.airswap.senderAuthorizations(this.vault.address, manager)
        );
      });

      it("changes the manager", async function () {
        await this.vault.connect(ownerSigner).setManager(owner);
        await this.vault.connect(ownerSigner).setManager(manager);
        assert.equal(await this.vault.manager(), manager);
        assert.isFalse(
          await this.airswap.senderAuthorizations(this.vault.address, owner)
        );
        assert.isFalse(
          await this.airswap.senderAuthorizations(this.vault.address, manager)
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

      it("is able to set the fee recipient to vault", async function () {
        await this.vault
          .connect(ownerSigner)
          .setFeeRecipient(this.vault.address);
        assert.equal(await this.vault.feeRecipient(), this.vault.address);
      });
    });

    // Only apply to when assets is WETH
    if (params.collateralAsset === WETH_ADDRESS) {
      describe("#depositETH", () => {
        time.revertToSnapshotAfterEach();

        it("deposits successfully", async function () {
          const depositAmount = parseEther("1");
          const res = await this.vault.depositETH({ value: depositAmount });
          const receipt = await res.wait();

          assert.isAtMost(receipt.gasUsed.toNumber(), 150000);

          assert.equal(
            (await this.vault.totalSupply()).toString(),
            depositAmount
          );
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
          await this.assetContract
            .connect(userSigner)
            .deposit({ value: parseEther("1") });
          await this.assetContract
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
          await this.assetContract
            .connect(userSigner)
            .deposit({ value: parseEther("1") });
          await this.assetContract
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

        it("does not inflate the share tokens on initialization", async function () {
          await this.assetContract
            .connect(adminSigner)
            .deposit({ value: parseEther("10") });
          await this.assetContract
            .connect(adminSigner)
            .transfer(this.vault.address, parseEther("10"));

          await this.vault
            .connect(userSigner)
            .depositETH({ value: parseEther("1") });

          // user needs to get back exactly 1 ether
          // even though the total has been incremented
          assert.isFalse((await this.vault.balanceOf(user)).isZero());
        });

        it("reverts when minimum shares are not minted", async function () {
          await expect(
            this.vault.connect(userSigner).depositETH({
              value: BigNumber.from("10").pow("10").sub(BigNumber.from("1")),
            })
          ).to.be.revertedWith(/Insufficient asset balance/);
        });
      });
    }

    describe("#deposit", () => {
      time.revertToSnapshotAfterEach();

      beforeEach(async function () {
        // Deposit only if asset is WETH
        if (params.collateralAsset === WETH_ADDRESS) {
          const addressToDeposit = [
            userSigner,
            managerSigner,
            counterpartySigner,
            adminSigner,
          ];

          for (let i = 0; i < addressToDeposit.length; i++) {
            const weth = this.assetContract.connect(addressToDeposit[i]);
            await weth.deposit({ value: parseEther("10") });
            await weth.approve(this.vault.address, parseEther("10"));
          }
        }
      });

      it("deposits successfully", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await this.assetContract
          .connect(userSigner)
          .approve(this.vault.address, depositAmount);

        const res = await this.vault.deposit(depositAmount);
        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed.toNumber(), 150000);

        assert.equal(
          (await this.vault.totalSupply()).toString(),
          depositAmount
        );
        assert.equal(
          (await this.vault.balanceOf(user)).toString(),
          depositAmount
        );
        await expect(res)
          .to.emit(this.vault, "Deposit")
          .withArgs(user, depositAmount, depositAmount);
      });

      it("consumes less than 100k gas in ideal scenario", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await this.vault.connect(managerSigner).deposit(depositAmount);

        const res = await this.vault.deposit(depositAmount);
        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed.toNumber(), 100000);
      });

      it("returns the correct number of shares back", async function () {
        const depositAmount = BigNumber.from("100000000000");
        // first user gets 3 shares
        await this.vault.connect(userSigner).deposit(depositAmount);
        assert.equal(
          (await this.vault.balanceOf(user)).toString(),
          depositAmount
        );

        // simulate the vault accumulating more WETH
        await this.assetContract
          .connect(userSigner)
          .transfer(this.vault.address, depositAmount);

        assert.equal(
          (await this.vault.totalBalance()).toString(),
          depositAmount.add(depositAmount)
        );

        // formula:
        // (depositAmount * totalSupply) / total
        // (1 * 1) / 2 = 0.5 shares
        const res = await this.vault
          .connect(counterpartySigner)
          .deposit(depositAmount);
        assert.equal(
          (await this.vault.balanceOf(counterparty)).toString(),
          BigNumber.from("50000000000")
        );
        await expect(res)
          .to.emit(this.vault, "Deposit")
          .withArgs(counterparty, depositAmount, BigNumber.from("50000000000"));
      });

      it("accounts for the amounts that are locked", async function () {
        const depositAmount = BigNumber.from("100000000000");
        // first user gets 3 shares
        await this.vault.connect(userSigner).deposit(depositAmount);

        // simulate the vault accumulating more WETH
        await this.assetContract
          .connect(userSigner)
          .transfer(this.vault.address, depositAmount);

        await this.rollToNextOption();

        // formula:
        // (depositAmount * totalSupply) / total
        // (1 * 1) / 2 = 0.5 shares
        await this.vault.connect(counterpartySigner).deposit(depositAmount);
        assert.equal(
          (await this.vault.balanceOf(counterparty)).toString(),
          BigNumber.from("50000000000")
        );
      });

      it("reverts when no value passed", async function () {
        await expect(
          this.vault.connect(userSigner).deposit(0)
        ).to.be.revertedWith(/Insufficient asset balance/);
      });

      it("does not inflate the share tokens on initialization", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await this.assetContract
          .connect(adminSigner)
          .transfer(this.vault.address, depositAmount);

        await this.vault
          .connect(userSigner)
          .deposit(BigNumber.from("10000000000"));

        // user needs to get back exactly 1 ether
        // even though the total has been incremented
        assert.isFalse((await this.vault.balanceOf(user)).isZero());
      });

      it("reverts when minimum shares are not minted", async function () {
        await expect(
          this.vault
            .connect(userSigner)
            .deposit(
              BigNumber.from(this.minimumSupply).sub(BigNumber.from("1"))
            )
        ).to.be.revertedWith(/Insufficient asset balance/);
      });
    });

    describe("signing an order message", () => {
      it("signs an order message", async function () {
        const sellToken = this.oTokenAddress;
        const buyToken = params.asset;
        const buyAmount = parseEther("0.1");
        const sellAmount = BigNumber.from("100000000");

        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
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
        assert.equal(ethers.utils.getAddress(signatory), counterparty);
        assert.equal(ethers.utils.getAddress(validator), SWAP_ADDRESS);
        assert.equal(ethers.utils.getAddress(signerWallet), counterparty);
        assert.equal(ethers.utils.getAddress(signerToken), params.asset);
        assert.equal(ethers.utils.getAddress(senderWallet), this.vault.address);
        assert.equal(ethers.utils.getAddress(senderToken), this.oTokenAddress);
        assert.equal(signerAmount, buyAmount);
        assert.equal(senderAmount, sellAmount.toString());
      });
    });

    describe("#commitAndClose", () => {
      time.revertToSnapshotAfterEach();

      it("reverts when not called with manager", async function () {
        await expect(
          this.vault
            .connect(userSigner)
            .commitAndClose(this.optionTerms, { from: user })
        ).to.be.revertedWith("Only manager");
      });

      it("reverts when option is 0x0", async function () {
        const optionTerms = [
          params.asset,
          params.strikeAsset,
          params.collateralAsset,
          "1610697601",
          parseEther("1480"),
          this.optionType,
          params.asset,
        ];

        await expect(
          this.vault.connect(managerSigner).commitAndClose(optionTerms)
        ).to.be.revertedWith("!option");
      });

      it("reverts when otoken underlying is different from vault's underlying", async function () {
        const underlying = params.wrongUnderlyingAsset;
        const strike = params.strikeAsset;
        const strikePrice = parseEther("50000");
        const expiry = secondOption.expiry.toString();
        const isPut = params.isPut;
        const collateral = isPut ? params.collateralAsset : underlying;

        await whitelistProduct(underlying, strike, collateral, isPut);

        await this.oTokenFactory.createOtoken(
          underlying,
          strike,
          collateral,
          strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
          expiry,
          isPut
        );

        const optionTerms = [
          underlying,
          strike,
          collateral,
          expiry,
          strikePrice,
          this.optionType,
          params.strikeAsset,
        ];

        await expect(
          this.vault.connect(managerSigner).commitAndClose(optionTerms)
        ).to.be.revertedWith("Wrong underlyingAsset");
      });

      it("reverts when otoken collateral is different from vault's asset", async function () {
        const underlying = params.asset;
        const strike = params.strikeAsset;
        const strikePrice = parseEther("50000");
        const expiry = secondOption.expiry.toString();
        const isPut = params.isPut;

        // We reverse this so that put
        const collateral = isPut ? underlying : strike;

        await whitelistProduct(underlying, strike, collateral, isPut);

        await this.oTokenFactory.createOtoken(
          underlying,
          strike,
          collateral,
          strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
          expiry,
          isPut
        );

        const optionTerms = [
          underlying,
          strike,
          collateral,
          expiry,
          strikePrice,
          this.optionType,
          params.strikeAsset,
        ];

        await expect(
          this.vault.connect(managerSigner).commitAndClose(optionTerms)
        ).to.be.revertedWith("Wrong collateralAsset");
      });

      it("reverts when the strike is not USDC", async function () {
        const underlying = params.asset;
        const strike = params.wrongStrikeAsset;
        const collateral = params.collateralAsset;
        const strikePrice = parseEther("50000");
        const expiry = secondOption.expiry.toString();
        const isPut = params.isPut;

        await whitelistProduct(underlying, strike, collateral, isPut);

        await this.oTokenFactory.createOtoken(
          underlying,
          strike,
          collateral,
          strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
          expiry,
          isPut
        );

        const optionTerms = [
          underlying,
          strike,
          collateral,
          expiry,
          strikePrice,
          this.optionType,
          params.strikeAsset,
        ];

        await expect(
          this.vault.connect(managerSigner).commitAndClose(optionTerms)
        ).to.be.revertedWith("strikeAsset != USDC");
      });

      it("reverts when the option type does not match", async function () {
        const underlying = params.asset;
        const strike = params.strikeAsset;
        const strikePrice = parseEther("50000");
        const expiry = secondOption.expiry.toString();
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
          this.isPut ? 2 : 1,
          params.strikeAsset,
        ];

        await expect(
          this.vault.connect(managerSigner).commitAndClose(optionTerms)
        ).to.be.revertedWith(this.isPut ? "!put" : "!call");
      });

      it("reverts when the expiry is before the delay", async function () {
        const block = await provider.getBlock();

        const underlying = params.asset;
        const strike = params.strikeAsset;
        const collateral = params.collateralAsset;
        const strikePrice = parseEther(params.firstOptionStrike.toString());
        const isPut = params.isPut;

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
          collateral,
          strikePrice.div(BigNumber.from("10").pow(BigNumber.from("10"))),
          expiry,
          isPut
        );
        await time.increaseTo(
          expiryDate.subtract(OPTION_DELAY, "seconds").valueOf() / 1000
        );

        const optionTerms = [
          underlying,
          strike,
          collateral,
          expiry,
          strikePrice,
          this.optionType,
          params.strikeAsset,
        ];

        await expect(
          this.vault.connect(managerSigner).commitAndClose(optionTerms)
        ).to.be.revertedWith("Option expiry cannot be before delay");
      });

      it("sets the next option and closes existing short", async function () {
        const res = await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms, { from: manager });

        const receipt = await res.wait();
        const block = await provider.getBlock(receipt.blockNumber);

        assert.equal(await this.vault.nextOption(), this.oTokenAddress);
        assert.equal(
          (await this.vault.nextOptionReadyAt()).toNumber(),
          parseInt(block.timestamp) + OPTION_DELAY
        );
        assert.isTrue((await this.vault.lockedAmount()).isZero());
        assert.equal(await this.vault.currentOption(), constants.AddressZero);
      });

      it("should set the next option twice", async function () {
        await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            firstOption.expiry.toString(),
            parseEther(params.firstOptionStrike.toString()),
            this.optionType,
            params.asset,
          ]);

        await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            secondOption.expiry.toString(),
            parseEther(params.secondOptionStrike.toString()),
            this.optionType,
            params.asset,
          ]);
      });
    });

    describe("#closeShort", () => {
      time.revertToSnapshotAfterEach(async function () {
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          this.depositAmount
        );

        this.oracle = await setupOracle(params.chainlinkPricer, ownerSigner);

        if (params.collateralAsset === WETH_ADDRESS) {
          const weth = this.assetContract.connect(counterpartySigner);
          await weth.deposit({ value: this.premium });
          await weth.approve(SWAP_ADDRESS, this.premium);
          return;
        }

        if (params.mintConfig) {
          await mintToken(
            this.assetContract,
            params.mintConfig.contractOwnerAddress,
            counterpartySigner,
            SWAP_ADDRESS,
            this.premium
          );
          return;
        }
      });

      it("doesnt do anything when no existing short", async function () {
        const tx = await this.vault.closeShort();
        await expect(tx).to.not.emit(this.vault, "CloseShort");
      });

      it("reverts when closing short before expiry", async function () {
        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);

        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        await this.vault.connect(managerSigner).rollToNextOption();

        await expect(this.vault.closeShort()).to.be.revertedWith(
          "Cannot close short before expiry"
        );
      });

      it("closes the short after expiry", async function () {
        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);

        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        await this.vault.connect(managerSigner).rollToNextOption();

        await setOpynOracleExpiryPrice(
          params.asset,
          this.oracle,
          await this.vault.currentOptionExpiry(),
          this.isPut
            ? BigNumber.from("7780000000000")
            : BigNumber.from("148000000000").sub(BigNumber.from("1"))
        );

        const closeTx = await this.vault.closeShort();

        assert.isTrue((await this.vault.lockedAmount()).isZero());

        assert.equal(
          (await this.vault.totalBalance()).toString(),
          this.depositAmount
        );

        await expect(closeTx)
          .to.emit(this.vault, "CloseShort")
          .withArgs(
            secondOption.address,
            wmul(this.depositAmount, LOCKED_RATIO),
            user
          );
      });
    });

    describe("#rollToNextOption", () => {
      time.revertToSnapshotAfterEach(async function () {
        const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO).toString();
        this.sellAmount = params.expectedMintAmount;
        if (this.isPut) {
          this.actualMintAmount = BigNumber.from(lockedAmount)
            .div(params.secondOptionStrike.toString())
            .mul(BigNumber.from("100000000"))
            .div(BigNumber.from("1000000"))
            .toString();
        } else {
          if (this.collateralAsset === WETH_ADDRESS) {
            this.actualMintAmount = BigNumber.from(lockedAmount).div(
              BigNumber.from("10000000000")
            );
          } else {
            this.actualMintAmount = lockedAmount;
          }
        }

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          this.depositAmount
        );

        this.oracle = await setupOracle(params.chainlinkPricer, ownerSigner);

        if (params.collateralAsset === WETH_ADDRESS) {
          const weth = this.assetContract.connect(counterpartySigner);
          await weth.deposit({ value: this.premium });
          await weth.approve(SWAP_ADDRESS, this.premium);
          return;
        }

        if (params.mintConfig) {
          await mintToken(
            this.assetContract,
            params.mintConfig.contractOwnerAddress,
            counterpartySigner,
            SWAP_ADDRESS,
            this.premium
          );
          return;
        }
      });

      it("reverts when not called with manager", async function () {
        await expect(
          this.vault.connect(userSigner).rollToNextOption()
        ).to.be.revertedWith("Only manager");
      });

      it("reverts when delay not passed", async function () {
        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);

        // will revert when trying to roll immediately
        await expect(
          this.vault.connect(managerSigner).rollToNextOption()
        ).to.be.revertedWith("Cannot roll before delay");

        time.increaseTo(
          (await this.vault.nextOptionReadyAt()).sub(BigNumber.from("1"))
        );

        await expect(
          this.vault.connect(managerSigner).rollToNextOption()
        ).to.be.revertedWith("Cannot roll before delay");
      });

      it("mints oTokens and deposits collateral into vault", async function () {
        const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO);
        const availableAmount = wmul(this.depositAmount, WITHDRAWAL_BUFFER);

        const startMarginBalance = await this.assetContract.balanceOf(
          MARGIN_POOL
        );

        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);

        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const res = this.vault.connect(managerSigner).rollToNextOption();

        await expect(res).to.not.emit(this.vault, "CloseShort");

        await expect(res)
          .to.emit(this.vault, "OpenShort")
          .withArgs(this.oTokenAddress, lockedAmount, manager);

        assert.equal(
          (await this.vault.lockedAmount()).toString(),
          lockedAmount
        );

        assert.equal(
          (await this.vault.assetBalance()).toString(),
          availableAmount
        );

        assert.equal(
          (await this.assetContract.balanceOf(MARGIN_POOL))
            .sub(startMarginBalance)
            .toString(),
          lockedAmount.toString()
        );

        assert.equal(
          this.expectedMintAmount.toString(),
          this.actualMintAmount.toString()
        );

        assert.equal(
          (await this.oToken.balanceOf(this.vault.address)).toString(),
          this.expectedMintAmount.toString()
        );

        assert.equal(await this.vault.currentOption(), this.oTokenAddress);

        assert.equal(
          (
            await this.oToken.allowance(this.vault.address, SWAP_ADDRESS)
          ).toString(),
          this.expectedMintAmount.toString()
        );
      });

      it("reverts when calling before expiry", async function () {
        const firstOptionAddress = firstOption.address;

        await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            firstOption.expiry.toString(),
            parseEther(params.firstOptionStrike.toString()),
            this.optionType,
            params.asset,
          ]);

        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const firstTx = await this.vault
          .connect(managerSigner)
          .rollToNextOption();

        const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO);
        const withdrawBuffer = wmul(this.depositAmount, parseEther("0.1"));

        await expect(firstTx)
          .to.emit(this.vault, "OpenShort")
          .withArgs(firstOptionAddress, lockedAmount, manager);

        // 90% of the vault's balance is allocated to short
        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          withdrawBuffer.toString()
        );

        await expect(
          this.vault
            .connect(managerSigner)
            .commitAndClose([
              params.asset,
              params.strikeAsset,
              params.collateralAsset,
              secondOption.expiry.toString(),
              parseEther(params.secondOptionStrike.toString()),
              this.optionType,
              params.asset,
            ])
        ).to.be.revertedWith("Cannot close short before expiry");
      });

      it("withdraws and roll funds into next option, after expiry ITM", async function () {
        const firstOptionAddress = firstOption.address;
        const secondOptionAddress = secondOption.address;

        await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            firstOption.expiry.toString(),
            parseEther(params.firstOptionStrike.toString()),
            this.optionType,
            params.asset,
          ]);
        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const firstTx = await this.vault
          .connect(managerSigner)
          .rollToNextOption();

        assert.equal(await this.vault.currentOption(), firstOptionAddress);
        assert.equal(
          await this.vault.currentOptionExpiry(),
          firstOption.expiry
        );

        await expect(firstTx)
          .to.emit(this.vault, "OpenShort")
          .withArgs(
            firstOptionAddress,
            wmul(this.depositAmount, LOCKED_RATIO),
            manager
          );

        // Perform the swap to deposit premiums and remove otokens
        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: firstOptionAddress,
          buyToken: params.collateralAsset,
          sellAmount: this.sellAmount.toString(),
          buyAmount: this.premium.toString(),
        });

        await this.vault.connect(managerSigner).sellOptions(signedOrder);

        // only the premium should be left over because the funds are locked into Opyn
        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          wmul(this.depositAmount, WITHDRAWAL_BUFFER).add(this.premium)
        );

        const settlementPriceITM = this.isPut
          ? parseEther(params.firstOptionStrike.toString())
              .div(BigNumber.from("10").pow(BigNumber.from("10")))
              .sub(1)
          : parseEther(params.firstOptionStrike.toString())
              .div(BigNumber.from("10").pow(BigNumber.from("10")))
              .add(1);

        // withdraw 100% because it's OTM
        await setOpynOracleExpiryPrice(
          params.asset,
          this.oracle,
          await this.vault.currentOptionExpiry(),
          settlementPriceITM
        );

        const beforeBalance = await this.assetContract.balanceOf(
          this.vault.address
        );

        const firstCloseTx = await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            secondOption.expiry.toString(),
            parseEther(params.secondOptionStrike.toString()),
            this.optionType,
            params.asset,
          ]);

        const afterBalance = await this.assetContract.balanceOf(
          this.vault.address
        );

        // test that the vault's balance decreased after closing short when ITM
        assert.isAbove(
          parseInt(wmul(this.depositAmount, LOCKED_RATIO).toString()),
          parseInt(BigNumber.from(afterBalance).sub(beforeBalance).toString())
        );

        await expect(firstCloseTx)
          .to.emit(this.vault, "CloseShort")
          .withArgs(
            firstOptionAddress,
            BigNumber.from(afterBalance).sub(beforeBalance),
            manager
          );

        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const currBalance = await this.assetContract.balanceOf(
          this.vault.address
        );
        const mintAmount = wmul(currBalance, LOCKED_RATIO).toString();

        const secondTx = await this.vault
          .connect(managerSigner)
          .rollToNextOption();

        assert.equal(await this.vault.currentOption(), secondOptionAddress);
        assert.equal(
          await this.vault.currentOptionExpiry(),
          secondOption.expiry
        );

        await expect(secondTx)
          .to.emit(this.vault, "OpenShort")
          .withArgs(secondOptionAddress, mintAmount, manager);

        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          wmul(currBalance, WITHDRAWAL_BUFFER).toString()
        );
      });

      it("withdraws and roll funds into next option, after expiry OTM", async function () {
        const firstOptionAddress = firstOption.address;
        const secondOptionAddress = secondOption.address;

        await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            firstOption.expiry.toString(),
            parseEther(params.firstOptionStrike.toString()),
            this.optionType,
            params.collateralAsset,
          ]);
        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const firstTx = await this.vault
          .connect(managerSigner)
          .rollToNextOption();

        await expect(firstTx)
          .to.emit(this.vault, "OpenShort")
          .withArgs(
            firstOptionAddress,
            wmul(this.depositAmount, LOCKED_RATIO),
            manager
          );

        // Perform the swap to deposit premiums and remove otokens
        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: firstOptionAddress,
          buyToken: params.collateralAsset,
          sellAmount: this.sellAmount.toString(),
          buyAmount: this.premium.toString(),
        });

        await this.vault.connect(managerSigner).sellOptions(signedOrder);

        // only the premium should be left over because the funds are locked into Opyn
        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          wmul(this.depositAmount, WITHDRAWAL_BUFFER).add(this.premium)
        );

        const settlementPriceOTM = this.isPut
          ? parseEther(params.firstOptionStrike.toString())
              .div(BigNumber.from("10").pow(BigNumber.from("10")))
              .add(1)
          : parseEther(params.firstOptionStrike.toString())
              .div(BigNumber.from("10").pow(BigNumber.from("10")))
              .sub(1);

        // withdraw 100% because it's OTM
        await setOpynOracleExpiryPrice(
          params.asset,
          this.oracle,
          await this.vault.currentOptionExpiry(),
          settlementPriceOTM
        );

        const beforeBalance = await this.assetContract.balanceOf(
          this.vault.address
        );

        const firstCloseTx = await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            secondOption.expiry.toString(),
            parseEther(params.secondOptionStrike.toString()),
            this.optionType,
            params.collateralAsset,
          ]);

        const afterBalance = await this.assetContract.balanceOf(
          this.vault.address
        );
        // test that the vault's balance decreased after closing short when ITM
        assert.equal(
          parseInt(wmul(this.depositAmount, LOCKED_RATIO).toString()),
          parseInt(BigNumber.from(afterBalance).sub(beforeBalance).toString())
        );

        await expect(firstCloseTx)
          .to.emit(this.vault, "CloseShort")
          .withArgs(
            firstOptionAddress,
            BigNumber.from(afterBalance).sub(beforeBalance),
            manager
          );

        // Time increase to after next option available
        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const secondTx = await this.vault
          .connect(managerSigner)
          .rollToNextOption();

        assert.equal(await this.vault.currentOption(), secondOptionAddress);
        assert.equal(
          await this.vault.currentOptionExpiry(),
          secondOption.expiry
        );

        await expect(secondTx)
          .to.emit(this.vault, "OpenShort")
          .withArgs(
            secondOptionAddress,
            wmul(this.depositAmount.add(this.premium), LOCKED_RATIO),
            manager
          );

        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          wmul(this.depositAmount.add(this.premium), WITHDRAWAL_BUFFER)
        );
      });

      it("is not able to roll to new option consecutively without setNextOption", async function () {
        await this.vault
          .connect(managerSigner)
          .commitAndClose([
            params.asset,
            params.strikeAsset,
            params.collateralAsset,
            firstOption.expiry.toString(),
            parseEther(params.firstOptionStrike.toString()),
            this.optionType,
            params.asset,
          ]);
        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        await this.vault.connect(managerSigner).rollToNextOption();

        await expect(
          this.vault.connect(managerSigner).rollToNextOption()
        ).to.be.revertedWith("No found option");
      });
    });

    describe("#emergencyWithdrawFromShort", () => {
      time.revertToSnapshotAfterTest();

      it("reverts when not allocated to a short", async function () {
        await expect(
          this.vault.connect(managerSigner).emergencyWithdrawFromShort()
        ).to.be.revertedWith("!currentOption");

        // doesn't matter if the nextOption is set
        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);

        await expect(
          this.vault.connect(managerSigner).emergencyWithdrawFromShort()
        ).to.be.revertedWith("!currentOption");
      });

      it("withdraws locked funds by closing short", async function () {
        const depositAmount = BigNumber.from("1000000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        await this.rollToNextOption();
        assert.equal(
          (await this.vault.assetBalance()).toString(),
          BigNumber.from("100000000000")
        );
        // this assumes that we found a way to get back the otokens
        await this.vault.connect(managerSigner).emergencyWithdrawFromShort();
        assert.equal(
          (await this.vault.assetBalance()).toString(),
          depositAmount
        );
        assert.equal(
          (await this.oToken.balanceOf(this.vault.address)).toString(),
          "0"
        );
        assert.equal(await this.vault.currentOption(), constants.AddressZero);
        assert.equal(await this.vault.nextOption(), constants.AddressZero);
        assert.isTrue((await this.vault.lockedAmount()).isZero());
        assert.equal(
          (await this.vault.totalBalance()).toString(),
          depositAmount
        ); // has to be same as initial amount
      });
    });

    describe("#sellOptions", () => {
      time.revertToSnapshotAfterEach(async function () {
        this.premium = BigNumber.from("100000000000");
        this.depositAmount = BigNumber.from("1000000000000");
        this.sellAmount = BigNumber.from("9");

        // Deposit counter party with asset
        if (params.collateralAsset === WETH_ADDRESS) {
          const weth = this.assetContract.connect(counterpartySigner);
          await weth.deposit({ value: this.premium });
          await weth.approve(SWAP_ADDRESS, this.premium);
        } else {
          await mintToken(
            this.assetContract,
            params.mintConfig.contractOwnerAddress,
            counterpartySigner,
            SWAP_ADDRESS,
            this.premium
          );
        }

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          this.depositAmount
        );

        await this.rollToNextOption();
      });

      it("completes the trade with the counterparty", async function () {
        const startSellTokenBalance = await this.oToken.balanceOf(
          this.vault.address
        );
        const startBuyTokenBalance = await this.assetContract.balanceOf(
          this.vault.address
        );

        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: this.oTokenAddress,
          buyToken: params.collateralAsset,
          sellAmount: this.sellAmount.toString(),
          buyAmount: this.premium.toString(),
        });

        const res = await this.vault
          .connect(managerSigner)
          .sellOptions(signedOrder);

        await expect(res)
          .to.emit(this.oToken, "Transfer")
          .withArgs(this.vault.address, counterparty, this.sellAmount);

        const wethERC20 = await getContractAt(
          "IERC20",
          this.assetContract.address
        );

        await expect(res)
          .to.emit(wethERC20, "Transfer")
          .withArgs(counterparty, this.vault.address, this.premium);

        assert.deepEqual(
          await this.oToken.balanceOf(this.vault.address),
          startSellTokenBalance.sub(this.sellAmount)
        );
        assert.deepEqual(
          await this.assetContract.balanceOf(this.vault.address),
          startBuyTokenBalance.add(this.premium)
        );
      });

      it("reverts when not selling option token", async function () {
        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: constants.AddressZero,
          buyToken: params.asset,
          sellAmount: this.sellAmount.toString(),
          buyAmount: this.premium.toString(),
        });

        await expect(
          this.vault.connect(managerSigner).sellOptions(signedOrder)
        ).to.be.revertedWith("Can only sell currentOption");
      });

      it("reverts when not buying asset token", async function () {
        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: this.oTokenAddress,
          buyToken: constants.AddressZero,
          sellAmount: this.sellAmount.toString(),
          buyAmount: this.premium.toString(),
        });

        await expect(
          this.vault.connect(managerSigner).sellOptions(signedOrder)
        ).to.be.revertedWith("Can only buy with asset token");
      });

      it("reverts when sender.wallet is not vault", async function () {
        const signedOrder = await signOrderForSwap({
          vaultAddress: constants.AddressZero,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: this.oTokenAddress,
          buyToken: params.asset,
          sellAmount: this.sellAmount.toString(),
          buyAmount: this.premium.toString(),
        });

        await expect(
          this.vault.connect(managerSigner).sellOptions(signedOrder)
        ).to.be.revertedWith("Sender can only be vault");
      });
    });

    describe("#assetBalance", () => {
      time.revertToSnapshotAfterEach(async function () {
        this.depositAmount = BigNumber.from("100000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          this.depositAmount
        );

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
        const depositAmount = BigNumber.from("1000000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        const freeAmount = depositAmount.add(
          wmul(this.depositAmount, parseEther("0.1"))
        );

        assert.equal((await this.vault.assetBalance()).toString(), freeAmount);
      });
    });

    if (params.collateralAsset === WETH_ADDRESS) {
      describe("#withdrawETH", () => {
        time.revertToSnapshotAfterEach();

        it("reverts when withdrawing more than balance", async function () {
          await this.vault.depositETH({ value: parseEther("10") });

          await this.rollToNextOption();

          await expect(
            this.vault.withdrawETH(parseEther("2"))
          ).to.be.revertedWith("Cannot withdraw more than available");
        });

        it("should withdraw funds, sending withdrawal fee to feeRecipient if <10%", async function () {
          await this.vault.depositETH({ value: parseEther("1") });

          const startETHBalance = await provider.getBalance(user);

          const res = await this.vault.withdrawETH(parseEther("0.1"), {
            gasPrice,
          });
          const receipt = await res.wait();
          const gasFee = gasPrice.mul(receipt.gasUsed);

          // Vault receives withdrawal fee
          assert.equal(
            (await this.assetContract.balanceOf(this.vault.address)).toString(),
            parseEther("0.9005").toString()
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
          await this.assetContract
            .connect(userSigner)
            .deposit({ value: parseEther("1") });
          await this.assetContract
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
          const res = await this.vault.withdrawETH(parseEther("1"), {
            gasPrice,
          });
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

          await this.assetContract
            .connect(counterpartySigner)
            .deposit({ value: parseEther("10") });
          await this.assetContract
            .connect(counterpartySigner)
            .transfer(this.vault.address, parseEther("10"));

          // As the pool expands, using 1 pool share will redeem more amount of collateral
          const res = await this.vault.withdrawETH(parseEther("1"), {
            gasPrice,
          });
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

        it("should be able to withdraw everything from the vault, leaving behind minimum", async function () {
          await this.vault.depositETH({ value: parseEther("1") });

          // simulate setting a bad otoken
          await this.vault
            .connect(managerSigner)
            .commitAndClose(this.optionTerms);

          // users should have time to withdraw
          await this.vault.withdrawETH(
            parseEther("1").sub(await this.vault.MINIMUM_SUPPLY())
          );
        });

        it("should revert when burning past minimum supply", async function () {
          await this.vault.depositETH({ value: parseEther("1") });

          // Only 1 ether - MINIMUM_SUPPLY works
          await expect(
            this.vault.withdrawETH(parseEther("1").sub(BigNumber.from("1")))
          ).to.be.revertedWith(/Insufficient share supply/);
        });
      });
    }

    describe("#withdrawAmountWithShares", () => {
      time.revertToSnapshotAfterEach();

      it("returns the correct withdrawal amount", async function () {
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          BigNumber.from("100000000000")
        );

        const balanceBeforeWithdraw = await this.assetContract.balanceOf(user);

        const [
          withdrawAmount,
          feeAmount,
        ] = await this.vault.withdrawAmountWithShares(
          BigNumber.from("10000000000")
        );

        assert.equal(withdrawAmount.toString(), BigNumber.from("9950000000"));
        assert.equal(feeAmount.toString(), BigNumber.from("50000000"));

        await this.vault.withdraw(BigNumber.from("10000000000"));

        // End balance should be start balance + withdraw amount
        assert.equal(
          parseInt(await this.assetContract.balanceOf(user)).toString(),
          parseInt(balanceBeforeWithdraw.add(withdrawAmount)).toString()
        );
      });
    });

    describe("#maxWithdrawAmount", () => {
      time.revertToSnapshotAfterEach();

      it("returns the max withdrawable amount accounting for the MINIMUM_SUPPLY", async function () {
        const depositAmount = BigNumber.from("100000000000");

        const minWithdrawAmount = depositAmount.sub(
          await this.vault.MINIMUM_SUPPLY()
        );

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        assert.equal(
          (await this.vault.maxWithdrawAmount(user)).toString(),
          minWithdrawAmount
        );
      });

      it("returns the max withdrawable amount", async function () {
        const depositAmount = BigNumber.from("900000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault.connect(managerSigner),
          depositAmount
        );
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          BigNumber.from("100000000000")
        );

        assert.equal(
          (await this.vault.maxWithdrawAmount(user)).toString(),
          BigNumber.from("100000000000").toString()
        );
      });
    });

    describe("#maxWithdrawableShares", () => {
      time.revertToSnapshotAfterEach();

      it("returns the max shares withdrawable of the system", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        assert.equal(
          (await this.vault.maxWithdrawableShares()).toString(),
          depositAmount.sub(await this.vault.MINIMUM_SUPPLY()).toString()
        );
      });
    });

    describe("#accountVaultBalance", () => {
      time.revertToSnapshotAfterEach();

      it("returns the ETH balance of the account in the vault", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        // Will be exactly the same number of Ether deposited initiall
        assert.equal(
          (await this.vault.accountVaultBalance(user)).toString(),
          depositAmount
        );

        // simulate the vault accumulating more WETH
        if (params.collateralAsset === WETH_ADDRESS) {
          await this.assetContract
            .connect(userSigner)
            .deposit({ value: parseEther("1") });
        }
        await this.assetContract
          .connect(userSigner)
          .transfer(this.vault.address, depositAmount);

        // User should be entitled to withdraw 2 ETH because the vault's balance expanded by 1 ETH
        assert.equal(
          (await this.vault.accountVaultBalance(user)).toString(),
          depositAmount.add(depositAmount)
        );
      });
    });

    describe("#assetAmountToShares", () => {
      time.revertToSnapshotAfterEach();

      it("should return the correct number of shares", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        // Will be exactly the same number of Ether deposited initially
        assert.equal(
          (await this.vault.assetAmountToShares(depositAmount)).toString(),
          depositAmount
        );

        // simulate the vault accumulating more WETH
        if (params.collateralAsset === WETH_ADDRESS) {
          await this.assetContract
            .connect(userSigner)
            .deposit({ value: parseEther("1") });
        }
        await this.assetContract
          .connect(userSigner)
          .transfer(this.vault.address, depositAmount);

        // User should be able to withdraw 2 ETH with 1 share
        assert.equal(
          (
            await this.vault.assetAmountToShares(
              depositAmount.add(depositAmount)
            )
          ).toString(),
          depositAmount
        );
      });
    });

    describe("#withdraw", () => {
      time.revertToSnapshotAfterEach();

      it("reverts when withdrawing more than balance", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        await this.rollToNextOption();

        await expect(
          this.vault.withdraw(BigNumber.from("20000000000"))
        ).to.be.revertedWith("Cannot withdraw more than available");
      });

      it("should withdraw funds, sending withdrawal fee to feeRecipient", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        const balanceBeforeWithdraw = await this.assetContract.balanceOf(user);

        await this.vault.withdraw(BigNumber.from("10000000000"));
        assert.equal(
          (await this.assetContract.balanceOf(user)).toString(),
          balanceBeforeWithdraw.add(BigNumber.from("9950000000"))
        );
      });

      it("should withdraw funds, sending withdrawal fee to feeRecipient if <10%", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        const startAssetBalance = await this.assetContract.balanceOf(user);

        const res = await this.vault.withdraw(BigNumber.from("10000000000"), {
          gasPrice,
        });
        await res.wait();

        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          BigNumber.from("90050000000").toString()
        );

        assert.equal(
          (await this.assetContract.balanceOf(user))
            .sub(startAssetBalance)
            .toString(),
          BigNumber.from("9950000000").toString()
        );

        // Share amount is burned
        assert.equal(
          (await this.vault.balanceOf(user)).toString(),
          BigNumber.from("90000000000")
        );

        assert.equal(
          (await this.vault.totalSupply()).toString(),
          BigNumber.from("90000000000")
        );

        await expect(res)
          .to.emit(this.vault, "Withdraw")
          .withArgs(
            user,
            BigNumber.from("9950000000"),
            BigNumber.from("10000000000"),
            BigNumber.from("50000000")
          );
      });

      it("should withdraw funds up to 10% of pool", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        // simulate the vault accumulating more WETH
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        assert.equal(
          (await this.vault.assetBalance()).toString(),
          depositAmount.add(depositAmount).toString()
        );

        const tx = await this.vault.withdraw(BigNumber.from("10000000000"));
        const receipt = await tx.wait();
        assert.isAtMost(receipt.gasUsed.toNumber(), 150000);
      });

      it("should only withdraw original deposit amount minus fees if vault doesn't expand", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        const startETHBalance = await this.assetContract.balanceOf(user);

        await depositIntoVault(
          params.collateralAsset,
          this.vault.connect(counterpartySigner),
          BigNumber.from("1000000000000")
        );

        // As the pool expands, using 1 pool share will redeem more amount of collateral
        const res = await this.vault.withdraw(depositAmount, {
          gasPrice,
        });
        await res.wait();

        assert.equal(
          (await this.assetContract.balanceOf(user))
            .sub(startETHBalance)
            .toString(),
          BigNumber.from("99500000000").toString()
        );
      });

      it("should withdraw more collateral when the balance increases", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        const startAssetBalance = await this.assetContract.balanceOf(user);

        await depositIntoVault(
          params.collateralAsset,
          this.vault.connect(counterpartySigner),
          BigNumber.from("1000000000000")
        );

        await depositIntoVault(
          params.collateralAsset,
          this.vault.connect(counterpartySigner),
          BigNumber.from("1000000000000")
        );

        // As the pool expands, using 1 pool share will redeem more amount of collateral
        const res = await this.vault.withdraw(depositAmount, {
          gasPrice,
        });
        await res.wait();

        assert.equal(
          (await this.assetContract.balanceOf(user))
            .sub(startAssetBalance)
            .toString(),
          BigNumber.from("99500000000")
        );
      });

      it("should revert if not enough shares", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        await depositIntoVault(
          params.collateralAsset,
          this.vault.connect(counterpartySigner),
          BigNumber.from("1000000000000")
        );

        await expect(
          this.vault.withdraw(depositAmount.add(BigNumber.from("10000000")))
        ).to.be.revertedWith("ERC20: burn amount exceeds balance");
      });

      it("should be able to withdraw everything from the vault, leaving behind minimum", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        // simulate setting a bad otoken
        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);

        // users should have time to withdraw
        await this.vault.withdraw(
          depositAmount.sub(await this.vault.MINIMUM_SUPPLY())
        );
      });

      it("should revert when burning past minimum supply", async function () {
        const depositAmount = BigNumber.from("10000000000");

        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        // only 1 ether - MINIMUM_SUPPLY works
        await expect(
          this.vault.withdraw(depositAmount.sub(BigNumber.from("1")))
        ).to.be.revertedWith(/Insufficient share supply/);
      });
    });

    describe("#withdrawToV1Vault", () => {
      time.revertToSnapshotAfterEach();

      it("should fail if vaults aren't registered", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        await expect(
          this.vault.withdrawToV1Vault(
            this.vault.maxWithdrawableShares(),
            this.spareVault.address
          )
        ).to.be.revertedWith("!feeless");
      });

      it("should transfer without fee", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        await this.registry.registerFreeWithdrawal(
          this.vault.address,
          this.spareVault.address
        );

        await this.vault.withdrawToV1Vault(
          BigNumber.from("10000000000"),
          this.spareVault.address
        );
        // No fee deposited back into 1st vault
        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          BigNumber.from("90000000000").toString()
        );
        assert.equal(
          (await this.vault.balanceOf(user)).toString(),
          BigNumber.from("90000000000").toString()
        );
        assert.equal(
          (
            await this.assetContract.balanceOf(this.spareVault.address)
          ).toString(),
          BigNumber.from("10000000000").toString()
        );
        assert.equal(
          await this.spareVault.balanceOf(user),
          BigNumber.from("10000000000").toString()
        );
      });

      it("should fail after revoking free withdraws", async function () {
        const depositAmount = BigNumber.from("100000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );

        await this.registry.registerFreeWithdrawal(
          this.vault.address,
          this.spareVault.address
        );

        await this.vault.withdrawToV1Vault(
          BigNumber.from("10000000000"),
          this.spareVault.address
        );
        // No fee deposited back into 1st vault
        assert.equal(
          (await this.assetContract.balanceOf(this.vault.address)).toString(),
          BigNumber.from("90000000000").toString()
        );
        assert.equal(
          (
            await this.assetContract.balanceOf(this.spareVault.address)
          ).toString(),
          BigNumber.from("10000000000").toString()
        );
        assert.equal(
          await this.spareVault.balanceOf(user),
          BigNumber.from("10000000000").toString()
        );
        await this.registry.revokeFreeWithdrawal(
          this.vault.address,
          this.spareVault.address
        );
        await expect(
          this.vault.withdrawToV1Vault(
            this.vault.maxWithdrawableShares(),
            this.spareVault.address
          )
        ).to.be.revertedWith("!feeless");
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
        const capAmount = BigNumber.from("100000000");
        const depositAmount = BigNumber.from("10000000000");
        await this.vault.connect(managerSigner).setCap(capAmount);

        // Provide some WETH to the account
        if (params.collateralAsset === WETH_ADDRESS) {
          const weth = this.assetContract.connect(userSigner);
          await weth.deposit({ value: depositAmount });
          await weth.approve(this.vault.address, depositAmount);
        }

        await expect(this.vault.deposit(depositAmount)).to.be.revertedWith(
          "Cap exceeded"
        );
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

      it("reverts when withdrawal fee set to 30%", async function () {
        await expect(
          this.vault.connect(managerSigner).setWithdrawalFee(parseEther("30"))
        ).to.be.revertedWith("withdrawalFee >= 30%");
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

    describe("#sunset", () => {
      time.revertToSnapshotAfterEach();

      it("reverts when not owner", async function () {
        await expect(
          this.vault.sunset(this.v2vault.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("succeeds when owner", async function () {
        await this.vault.connect(ownerSigner).sunset(this.v2vault.address);
        assert.equal(await this.vault.isSunset(), true);

        assert.equal(await this.vault.replacementVault(), this.v2vault.address);
      });

      it("deposits fail after sunset", async function () {
        await this.vault.connect(ownerSigner).sunset(this.v2vault.address);
        const depositAmount = BigNumber.from("10000000000");
        await expect(
          depositIntoVault(params.collateralAsset, this.vault, depositAmount)
        ).to.be.revertedWith("Cap exceeded");
      });

      if (params.collateralAsset === WETH_ADDRESS) {
        it("withdraw funds with no fee", async function () {
          await this.vault.depositETH({ value: parseEther("1") });
          await this.vault.connect(ownerSigner).sunset(this.v2vault.address);

          const startETHBalance = await provider.getBalance(user);

          const res = await this.vault.withdrawETH(parseEther("0.1"), {
            gasPrice,
          });
          const receipt = await res.wait();
          const gasFee = gasPrice.mul(receipt.gasUsed);

          // No fees
          assert.equal(
            (await this.assetContract.balanceOf(this.vault.address)).toString(),
            parseEther("0.9").toString()
          );

          assert.equal(
            (await provider.getBalance(user))
              .add(gasFee)
              .sub(startETHBalance)
              .toString(),
            parseEther("0.1").toString()
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
              parseEther("0.1"),
              parseEther("0.1"),
              parseEther("0.0")
            );
        });
      } else {
        it("withdraw funds with no fee", async function () {
          const depositAmount = BigNumber.from("100000000000");
          await depositIntoVault(
            params.collateralAsset,
            this.vault,
            depositAmount
          );
          await this.vault.connect(ownerSigner).sunset(this.v2vault.address);

          const startAssetBalance = await this.assetContract.balanceOf(user);

          const res = await this.vault.withdraw(BigNumber.from("10000000000"), {
            gasPrice,
          });
          await res.wait();

          assert.equal(
            (await this.assetContract.balanceOf(this.vault.address)).toString(),
            BigNumber.from("90000000000").toString()
          );

          assert.equal(
            (await this.assetContract.balanceOf(user))
              .sub(startAssetBalance)
              .toString(),
            BigNumber.from("10000000000").toString()
          );

          // Share amount is burned
          assert.equal(
            (await this.vault.balanceOf(user)).toString(),
            BigNumber.from("90000000000")
          );

          assert.equal(
            (await this.vault.totalSupply()).toString(),
            BigNumber.from("90000000000")
          );

          await expect(res)
            .to.emit(this.vault, "Withdraw")
            .withArgs(
              user,
              BigNumber.from("10000000000"),
              BigNumber.from("10000000000"),
              BigNumber.from("0")
            );
        });
      }
    });

    describe("#migrate", () => {
      time.revertToSnapshotAfterEach();

      it("migrate calls V2 depositFor with correct address and amount", async function () {
        // required for the next step to be able to fully withdraw
        const minimumAmount = BigNumber.from(await this.vault.MINIMUM_SUPPLY());
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          minimumAmount
        );

        const depositAmount = BigNumber.from("10000000000");
        await depositIntoVault(
          params.collateralAsset,
          this.vault,
          depositAmount
        );
        await expect(await this.vault.balanceOf(user)).to.be.above(0);

        await expect(this.vault.migrate()).to.be.revertedWith("Not sunset");

        await this.vault.connect(ownerSigner).sunset(this.v2vault.address);

        await this.vault.migrate();

        await expect(await this.vault.balanceOf(user)).to.be.equal(
          minimumAmount
        );
        await expect(
          await this.assetContract.balanceOf(this.vault.address)
        ).to.be.equal(minimumAmount);
      });
    });

    describe("#currentOptionExpiry", () => {
      it("should return 0 when currentOption not set", async function () {
        assert.equal((await this.vault.currentOptionExpiry()).toString(), "0");
      });
    });

    describe("#decimals", () => {
      it("should return 18 for decimals", async function () {
        assert.equal(
          (await this.vault.decimals()).toString(),
          this.tokenDecimals.toString()
        );
      });
    });
  });
}

async function signOrderForSwap({
  counterpartyAddress,
  vaultAddress,
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  signerPrivateKey,
}) {
  let order = createOrder({
    signer: {
      wallet: counterpartyAddress,
      token: buyToken,
      amount: buyAmount,
    },
    sender: {
      wallet: vaultAddress,
      token: sellToken,
      amount: sellAmount,
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

async function depositIntoVault(asset, vault, amount) {
  if (asset === WETH_ADDRESS) {
    await vault.depositETH({ value: amount });
  } else {
    await vault.deposit(amount);
  }
}
