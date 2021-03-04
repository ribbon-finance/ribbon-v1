const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { provider, BigNumber, constants } = ethers;
const { parseEther } = ethers.utils;

const time = require("../helpers/time.js");
const ZERO_EX_API_RESPONSES = require("../fixtures/GammaAdapter.json");
const {
  wmul,
  wdiv,
  setupOracle,
  setOpynOracleExpiryPrice,
} = require("../helpers/utils");

const GAMMA_CONTROLLER = "0x4ccc2339F87F6c59c6893E1A678c2266cA58dC72";
const MARGIN_POOL = "0x5934807cC0654d46755eBd2848840b616256C6Ef";
const GAMMA_ORACLE = "0xc497f40D1B7db6FA5017373f1a0Ec6d53126Da23";

const ORACLE_DISPUTE_PERIOD = 7200;
const ORACLE_LOCKING_PERIOD = 300;
const WAD = BigNumber.from("10").pow(BigNumber.from("18"));

const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.AddressZero;
let owner, user, recipient;
let ownerSigner;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("GammaAdapter", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [, ownerSigner, userSigner, recipientSigner] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    recipient = recipientSigner.address;

    const MockGammaAdapter = await ethers.getContractFactory(
      "MockGammaAdapter",
      ownerSigner
    );
    const GammaAdapter = await ethers.getContractFactory(
      "GammaAdapter",
      ownerSigner
    );
    const MockGammaController = await ethers.getContractFactory(
      "MockGammaController",
      ownerSigner
    );

    this.protocolName = "OPYN_GAMMA";
    this.nonFungible = false;

    this.mockController = await MockGammaController.deploy(
      GAMMA_ORACLE,
      UNISWAP_ROUTER,
      WETH_ADDRESS
    );

    this.mockController.setPrice("110000000000");

    this.gammaController = await ethers.getContractAt(
      "IController",
      GAMMA_CONTROLLER
    );

    this.mockAdapter = (
      await MockGammaAdapter.deploy(
        OTOKEN_FACTORY,
        this.mockController.address,
        WETH_ADDRESS,
        ZERO_EX_EXCHANGE,
        UNISWAP_ROUTER
      )
    ).connect(userSigner);

    this.adapter = (
      await GammaAdapter.deploy(
        OTOKEN_FACTORY,
        GAMMA_CONTROLLER,
        WETH_ADDRESS,
        ZERO_EX_EXCHANGE,
        UNISWAP_ROUTER
      )
    ).connect(userSigner);

    this.oracle = await setupOracle(ownerSigner);

    this.depositToVaultForShorts = depositToVaultForShorts;
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("#protocolName", () => {
    it("matches the protocol name", async function () {
      assert.equal(await this.adapter.protocolName(), this.protocolName);
    });
  });

  describe("#nonFungible", () => {
    it("matches the nonFungible bool", async function () {
      assert.equal(await this.adapter.nonFungible(), this.nonFungible);
    });
  });

  describe("#lookupOtoken", () => {
    it("looks up call oToken correctly", async function () {
      const oTokenAddress = "0x60ad22806B89DD17B2ecfe220c3712A2c86dfFFE";

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.AddressZero,
        USDC_ADDRESS,
        constants.AddressZero,
        "1614326400",
        parseEther("800"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualOTokenAddress, oTokenAddress);
    });

    it("looks up put oToken correctly", async function () {
      const oTokenAddress = "0x006583fEea92C695A9dE02C3AC2d4cd321f2F341";

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.AddressZero,
        USDC_ADDRESS,
        constants.AddressZero,
        "1610697600",
        parseEther("800"),
        PUT_OPTION_TYPE,
        constants.AddressZero,
      ]);
      assert.equal(actualOTokenAddress, oTokenAddress);
    });
  });

  behavesLikeOTokens({
    name: "Call ITM",
    oTokenAddress: "0x3cF86d40988309AF3b90C14544E1BB0673BFd439",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: parseEther("960"),
    settlePrice: "120000000000",
    expiry: "1614326400",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("12727272727272727"),
    premium: "50587453335072052",
  });

  behavesLikeOTokens({
    name: "Call OTM",
    oTokenAddress: "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: parseEther("1480"),
    settlePrice: "120000000000",
    expiry: "1610697600",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "18292499493934936",
  });

  behavesLikeOTokens({
    name: "Put OTM",
    oTokenAddress: "0x006583fEea92C695A9dE02C3AC2d4cd321f2F341",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    strikePrice: parseEther("800"),
    settlePrice: "120000000000",
    expiry: "1610697600",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    shortAmount: BigNumber.from("1000000000"),
    exerciseProfit: BigNumber.from("0"),
    premium: "16411974349332756",
  });
});

function behavesLikeOTokens(params) {
  describe(`${params.name}`, () => {
    before(async function () {
      const {
        underlying,
        strikeAsset,
        collateralAsset,
        strikePrice,
        paymentToken,
        expiry,
        optionType,
        oTokenAddress,
        purchaseAmount,
        exerciseProfit,
        shortAmount,
        premium,
        settlePrice,
      } = params;

      this.oTokenAddress = oTokenAddress;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.collateralAsset = collateralAsset;
      this.strikePrice = strikePrice;
      this.expiry = expiry;
      this.optionType = optionType;
      this.purchaseAmount = purchaseAmount;
      this.exerciseProfit = exerciseProfit;
      this.premium = premium;
      this.paymentToken = paymentToken || ETH_ADDRESS;
      this.shortAmount = shortAmount;
      this.settlePrice = settlePrice;
      this.apiResponse = ZERO_EX_API_RESPONSES[oTokenAddress];
      this.scaleDecimals = (n) =>
        n.div(BigNumber.from("10").pow(BigNumber.from("10")));

      this.oToken = await ethers.getContractAt("IERC20", oTokenAddress);

      this.optionTerms = [
        this.underlying,
        this.strikeAsset,
        this.collateralAsset,
        this.expiry,
        this.strikePrice,
        this.optionType,
        this.paymentToken,
      ];

      this.zeroExOrder = [
        this.apiResponse.to,
        this.apiResponse.buyTokenAddress,
        this.apiResponse.sellTokenAddress,
        this.apiResponse.to,
        this.apiResponse.protocolFee,
        this.apiResponse.buyAmount,
        this.apiResponse.sellAmount,
        this.apiResponse.data,
      ];
    });

    describe("#premium", () => {
      it("has a premium of 0", async function () {
        assert.equal(
          await this.adapter.premium(this.optionTerms, this.purchaseAmount),
          "0"
        );
      });
    });

    describe("#exerciseProfit", () => {
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("gets exercise profit", async function () {
        await time.increaseTo(this.expiry + 1);

        assert.equal(
          (
            await this.mockAdapter.exerciseProfit(
              this.oTokenAddress,
              0,
              this.purchaseAmount
            )
          ).toString(),
          this.exerciseProfit
        );
      });
    });

    describe("#purchaseWithZeroEx", () => {
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("purchases with 0x exchange", async function () {
        const res = await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          this.zeroExOrder,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: calculateZeroExOrderCost(this.apiResponse),
          }
        );

        const buyToken = await ethers.getContractAt(
          "IERC20",
          this.apiResponse.buyTokenAddress
        );
        const sellToken = await ethers.getContractAt(
          "IERC20",
          this.apiResponse.sellTokenAddress
        );

        assert.isAtLeast(
          (await buyToken.balanceOf(this.adapter.address)).toNumber(),
          parseInt(this.apiResponse.buyAmount)
        );
        assert.equal(await sellToken.balanceOf(this.adapter.address), "0");

        expect(res)
          .to.emit(this.adapter, "Purchased")
          .withArgs(
            user,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(this.protocolName)),
            this.underlying,
            this.premium,
            "0"
          );
      });

      it("purchases twice", async function () {
        await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          this.zeroExOrder,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: calculateZeroExOrderCost(this.apiResponse),
          }
        );

        await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          this.zeroExOrder,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: calculateZeroExOrderCost(this.apiResponse),
          }
        );
      });
    });

    describe("#exercise", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await time.takeSnapshot();

        // load the contract with collateralAsset
        await this.mockController.buyCollateral(this.oTokenAddress, {
          from: owner,
          value: parseEther("10"),
        });

        await this.mockAdapter.purchaseWithZeroEx(
          this.optionTerms,
          this.zeroExOrder,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: parseEther("5"),
          }
        );
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("exercises otokens", async function () {
        const recipientStartBalance = await provider.getBalance(recipient);

        if (BigNumber.from(this.exerciseProfit).isZero()) {
          return;
        }
        await time.increaseTo(this.expiry + 1);

        const res = await this.mockAdapter.mockedExercise(
          this.oTokenAddress,
          0,
          this.purchaseAmount,
          recipient,
          { from: user }
        );

        expect(res)
          .to.emit(this.mockAdapter, "Exercised")
          .withArgs(
            user,
            this.oTokenAddress,
            "0",
            this.purchaseAmount,
            this.exerciseProfit
          );

        const otoken = await ethers.getContractAt("IERC20", this.oTokenAddress);

        assert.equal((await otoken.balanceOf(user)).toString(), "0");
        assert.equal(
          (await otoken.balanceOf(this.mockAdapter.address)).toString(),
          "0"
        );

        if (this.collateralAsset == WETH_ADDRESS) {
          assert.equal(
            (await provider.getBalance(recipient))
              .sub(recipientStartBalance)
              .toString(),
            this.exerciseProfit
          );
        } else {
          const collateralToken = await ethers.getContractAt(
            "IERC20",
            this.collateralAsset
          );
          assert.equal(
            (await collateralToken.balanceOf(user)).toString(),
            this.exerciseProfit
          );
        }
      });
    });

    describe("#canExercise", () => {
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("can exercise", async function () {
        await time.increaseTo(this.expiry + 1);

        const res = await this.mockAdapter.canExercise(
          this.oTokenAddress,
          0,
          this.purchaseAmount
        );

        if (this.exerciseProfit.isZero()) {
          assert.isFalse(res);
          return;
        }

        assert.isTrue(res);
      });

      it("cannot exercise before expiry", async function () {
        const res = await this.mockAdapter.canExercise(
          this.oTokenAddress,
          0,
          this.purchaseAmount
        );
        assert.isFalse(res);
      });
    });

    describe("#createShort", () => {
      time.revertToSnapshotAfterEach(async function () {
        await this.depositToVaultForShorts(parseEther("10"));
      });

      it("reverts when no matched oToken", async function () {
        const optionTerms = [
          "0x0000000000000000000000000000000000000069",
          "0x0000000000000000000000000000000000000069",
          "0x0000000000000000000000000000000000000069",
          "1614326400",
          parseEther("800"),
          CALL_OPTION_TYPE,
          "0x0000000000000000000000000000000000000069",
        ];

        await expect(
          this.adapter.createShort(optionTerms, this.shortAmount)
        ).to.be.revertedWith("Invalid oToken");
      });

      it("reverts when depositing too little collateral for ETH", async function () {
        if (this.collateralAsset === WETH_ADDRESS) {
          await expect(
            this.adapter.createShort(this.optionTerms, 1)
          ).to.be.revertedWith(/Must deposit more than 10\*\*8 collateral/);
        }
      });

      it("creates a short position", async function () {
        const collateral = await ethers.getContractAt(
          "IERC20",
          this.collateralAsset
        );
        const initialPoolCollateralBalance = await collateral.balanceOf(
          MARGIN_POOL
        );

        await this.adapter.createShort(this.optionTerms, this.shortAmount);

        let oTokenMintedAmount;

        if (this.optionType === CALL_OPTION_TYPE) {
          oTokenMintedAmount = this.shortAmount.div(
            BigNumber.from("10").pow(BigNumber.from("10"))
          );
        } else {
          oTokenMintedAmount = wdiv(this.shortAmount, this.strikePrice)
            .mul(BigNumber.from("10").pow(BigNumber.from("8")))
            .div(BigNumber.from("10").pow(BigNumber.from("6")));
        }

        const vaultID = await this.gammaController.getAccountVaultCounter(
          this.adapter.address
        );
        assert.equal(vaultID, "1");

        assert.equal(
          (await this.oToken.balanceOf(this.adapter.address)).toString(),
          oTokenMintedAmount
        );

        const endPoolCollateralBalance = await collateral.balanceOf(
          MARGIN_POOL
        );
        assert.equal(
          endPoolCollateralBalance.sub(initialPoolCollateralBalance).toString(),
          this.shortAmount
        );
      });
    });

    describe("#closeShort", () => {
      time.revertToSnapshotAfterEach(async function () {
        const depositAmount = parseEther("10");

        await this.depositToVaultForShorts(depositAmount);

        await this.adapter.createShort(this.optionTerms, this.shortAmount);

        await setOpynOracleExpiryPrice(
          this.oracle,
          this.expiry,
          this.settlePrice
        );
      });

      it("settles the vault and withdraws collateral", async function () {
        const collateralToken = await ethers.getContractAt(
          "IERC20",
          this.collateralAsset
        );

        const startWETHBalance = await collateralToken.balanceOf(
          this.adapter.address
        );

        await this.adapter.closeShort();

        const strike = this.strikePrice;
        const shortAmount = this.shortAmount;

        const settlePrice = BigNumber.from(this.settlePrice).mul(
          BigNumber.from("10").pow(BigNumber.from("10"))
        );

        const inTheMoney =
          this.optionType === CALL_OPTION_TYPE
            ? settlePrice.gt(strike)
            : settlePrice.lt(strike);

        let shortOutcome;

        if (inTheMoney) {
          // lose money when short option and ITM
          // settlePrice = 1200, strikePrice = 9600
          // loss = (1200-960)/1200
          // shortOutcome = shortAmount - loss = 0.8 ETH

          const loss = settlePrice.sub(strike).mul(WAD).div(settlePrice);
          shortOutcome = shortAmount.sub(wmul(shortAmount, loss));
        } else {
          // If it's OTM, you will get back 100% of the collateral deposited
          shortOutcome = shortAmount;
        }

        assert.equal(
          (await collateralToken.balanceOf(this.adapter.address))
            .sub(startWETHBalance)
            .toString(),
          shortOutcome
        );
      });
    });

    describe("#getOptionsAddress", () => {
      it("returns the correct otoken address", async function () {
        assert.equal(
          await this.adapter.getOptionsAddress(this.optionTerms),
          this.oTokenAddress
        );
      });
    });
  });
}

async function depositToVaultForShorts(depositAmount) {
  if (this.collateralAsset === WETH_ADDRESS) {
    const wethContract = (
      await ethers.getContractAt("IWETH", WETH_ADDRESS)
    ).connect(ownerSigner);
    await wethContract.deposit({ from: owner, value: depositAmount });
    await wethContract.transfer(this.adapter.address, depositAmount, {
      from: owner,
    });
  } else {
    const router = (
      await ethers.getContractAt("IUniswapV2Router01", UNISWAP_ROUTER)
    ).connect(ownerSigner);
    const collateralToken = (
      await ethers.getContractAt("IERC20", this.collateralAsset)
    ).connect(ownerSigner);

    const amountsOut = await router.getAmountsOut(depositAmount, [
      WETH_ADDRESS,
      this.collateralAsset,
    ]);

    const amountOutMin = amountsOut[1];

    await router.swapExactETHForTokens(
      amountOutMin,
      [WETH_ADDRESS, this.collateralAsset],
      owner,
      Math.floor(Date.now() / 1000) + 69,
      { from: owner, value: depositAmount }
    );

    await collateralToken.transfer(this.adapter.address, amountOutMin, {
      from: owner,
    });
  }
}

function calculateZeroExOrderCost(apiResponse) {
  let decimals;

  if (apiResponse.sellTokenAddress === USDC_ADDRESS.toLowerCase()) {
    decimals = 10 ** 6;
  } else if (apiResponse.sellTokenAddress === WETH_ADDRESS.toLowerCase()) {
    return BigNumber.from(apiResponse.sellAmount);
  } else {
    decimals = 10 ** 18;
  }

  const scaledSellAmount = parseInt(apiResponse.sellAmount) / decimals;
  const totalETH =
    scaledSellAmount / parseFloat(apiResponse.sellTokenToEthRate);

  return parseEther(totalETH.toPrecision(6)).add(
    BigNumber.from(apiResponse.value)
  );
}
