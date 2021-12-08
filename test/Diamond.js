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
const WITHDRAWAL_FEE = parseEther("0.005");
const gasPrice = parseUnits("1", "gwei");

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("RibbonThetaVault", () => {
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
        registry.address,
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

    describe("#Dimond", () => {
      it("Flow", async function () {
        const depositAmount = parseEther("100");
        const res3 = await this.vault
          .connect(userSigner)
          .depositETH({ value: depositAmount });

        const lockedAmount = wmul(this.depositAmount, LOCKED_RATIO);
        const availableAmount = wmul(this.depositAmount, WITHDRAWAL_BUFFER);

        const startMarginBalance = await this.assetContract.balanceOf(
          MARGIN_POOL
        );

        // await this.vault
        //   .connect(managerSigner)
        //   .commitAndClose(this.optionTerms);

        // await time.increaseTo(
        //   (await this.vault.nextOptionReadyAt()).toNumber() + 1
        // );

        // const res = this.vault.connect(managerSigner).rollToNextOption();

        // const lockAmount = (await this.vault.lockedAmount()).toString()
        // const newAddAmount = (await this.assetContract.balanceOf(MARGIN_POOL))
        //     .sub(startMarginBalance)
        //     .toString()
        // const oTokenAmount = (await this.oToken.balanceOf(this.vault.address)).toString()
        // console.log('depositAmount',depositAmount.toString())
        // console.log('startMarginBalance',startMarginBalance.toString())
        // console.log('lockAmount',lockAmount)
        // console.log('newAddAmount',newAddAmount)
        // console.log('oTokenAmount',oTokenAmount)

        const firstOptionAddress = firstOption.address;
        const secondOptionAddress = secondOption.address;

        await this.vault
          .connect(managerSigner)
          .commitAndClose(this.optionTerms);
        await time.increaseTo(
          (await this.vault.nextOptionReadyAt()).toNumber() + 1
        );

        const firstTx = await this.vault
          .connect(managerSigner)
          .rollToNextOption();

        // assert.equal(await this.vault.currentOption(), firstOptionAddress);
        assert.equal(await this.vault.currentOption(), secondOptionAddress);

        assert.equal(
          await this.vault.currentOptionExpiry(),
          secondOption.expiry
        );

        const oTokenAmount = (
          await this.oToken.balanceOf(this.vault.address)
        ).toString();
        // console.log('depositAmount',depositAmount.toString())
        // console.log('startMarginBalance',startMarginBalance.toString())
        // console.log('lockAmount',lockAmount)
        // console.log('newAddAmount',newAddAmount)
        console.log("oTokenAmount", oTokenAmount);

        // Perform the swap to deposit premiums and remove otokens
        const signedOrder = await signOrderForSwap({
          vaultAddress: this.vault.address,
          counterpartyAddress: counterparty,
          signerPrivateKey: this.counterpartyWallet.privateKey,
          sellToken: secondOptionAddress,
          buyToken: params.collateralAsset,
          sellAmount: oTokenAmount.toString(),
          buyAmount: this.premium.toString(),
        });
        const weth = this.assetContract.connect(counterpartySigner);
        await weth.deposit({ value: this.premium });
        await weth.approve(SWAP_ADDRESS, this.premium);
        await this.vault.connect(managerSigner).sellOptions(signedOrder);
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
