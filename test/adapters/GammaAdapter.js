const { web3 } = require("@openzeppelin/test-environment");
const { expectEvent, balance } = require("@openzeppelin/test-helpers");
const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { provider, BigNumber, constants } = ethers;
const { parseEther } = ethers.utils;

const time = require("../helpers/time.js");
const ZERO_EX_API_RESPONSES = require("../fixtures/GammaAdapter.json");

const GAMMA_ORACLE = "0xc497f40D1B7db6FA5017373f1a0Ec6d53126Da23";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.AddressZero;
let owner, user, recipient;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
let IERC20;

describe("GammaAdapter", () => {
  let initSnapshotId;
  const gasPrice = ethers.utils.parseUnits("10", "gwei");

  before(async function () {
    const [
      ,
      ownerSigner,
      userSigner,
      recipientSigner,
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    recipient = recipientSigner.address;

    const MockGammaAdapter = await ethers.getContractFactory(
      "MockGammaAdapter",
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

    this.adapter = await MockGammaAdapter.deploy(
      OTOKEN_FACTORY,
      this.mockController.address,
      WETH_ADDRESS,
      ZERO_EX_EXCHANGE,
      UNISWAP_ROUTER
    );
    this.adapter = this.adapter.connect(userSigner);

    initSnapshotId = await time.takeSnapshot();
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
    expiry: "1614326400",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    exerciseProfit: BigNumber.from("12727272727272727"),
    premium: "50329523139774375",
  });

  behavesLikeOTokens({
    name: "Call OTM",
    oTokenAddress: "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: parseEther("1480"),
    expiry: "1610697600",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "18271767935676968",
  });

  behavesLikeOTokens({
    name: "Put OTM",
    oTokenAddress: "0x006583fEea92C695A9dE02C3AC2d4cd321f2F341",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    strikePrice: parseEther("800"),
    expiry: "1610697600",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "16125055430257410",
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
        expiry,
        optionType,
        oTokenAddress,
        purchaseAmount,
        exerciseProfit,
        premium,
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
      this.apiResponse = ZERO_EX_API_RESPONSES[oTokenAddress];
      this.scaleDecimals = (n) =>
        n.div(BigNumber.from("10").pow(BigNumber.from("10")));

      this.optionTerms = [
        this.underlying,
        this.strikeAsset,
        this.collateralAsset,
        this.expiry,
        this.strikePrice,
        this.optionType,
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
            await this.adapter.exerciseProfit(
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
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.scaleDecimals(this.purchaseAmount),
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

        await this.adapter.purchaseWithZeroEx(
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

        const res = await this.adapter.mockedExercise(
          this.oTokenAddress,
          0,
          this.purchaseAmount,
          recipient,
          { from: user }
        );

        expect(res)
          .to.emit(this.adapter, "Exercised")
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
          (await otoken.balanceOf(this.adapter.address)).toString(),
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

        const res = await this.adapter.canExercise(
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
        const res = await this.adapter.canExercise(
          this.oTokenAddress,
          0,
          this.purchaseAmount
        );
        assert.isFalse(res);
      });
    });
  });
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
