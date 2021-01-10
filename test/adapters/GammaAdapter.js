const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
  BN,
  ether,
  constants,
  time,
  expectRevert,
  expectEvent,
  balance,
} = require("@openzeppelin/test-helpers");
const { assert } = require("chai");
const helper = require("../helper.js");
const MockGammaAdapter = contract.fromArtifact("MockGammaAdapter");
const MockGammaController = contract.fromArtifact("MockGammaController");
const IERC20 = contract.fromArtifact("IERC20");
const ZERO_EX_API_RESPONSES = require("../fixtures/GammaAdapter.json");

const GAMMA_CONTROLLER = "0x4ccc2339F87F6c59c6893E1A678c2266cA58dC72";
const GAMMA_ORACLE = "0xc497f40D1B7db6FA5017373f1a0Ec6d53126Da23";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const [admin, owner, user, recipient] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("GammaAdapter", () => {
  let initSnapshotId;
  const gasPrice = web3.utils.toWei("10", "gwei");

  before(async function () {
    this.protocolName = "OPYN_GAMMA";
    this.nonFungible = false;

    this.mockController = await MockGammaController.new(
      GAMMA_ORACLE,
      UNISWAP_ROUTER,
      WETH_ADDRESS
    );

    this.mockController.setPrice("110000000000");

    this.adapter = await MockGammaAdapter.new(
      OTOKEN_FACTORY,
      this.mockController.address,
      WETH_ADDRESS,
      ZERO_EX_EXCHANGE,
      UNISWAP_ROUTER,
      {
        from: owner,
      }
    );

    const snapShot = await helper.takeSnapshot();
    initSnapshotId = snapShot["result"];
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
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
    it("looks oToken correctly", async function () {
      const oTokenAddress = "0x60ad22806B89DD17B2ecfe220c3712A2c86dfFFE";

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.ZERO_ADDRESS,
        USDC_ADDRESS,
        WETH_ADDRESS,
        "1614326400",
        ether("800"),
        CALL_OPTION_TYPE,
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
    strikePrice: ether("960"),
    expiry: "1614326400",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: ether("0.1"),
    exerciseProfit: "12727272727272727",
    premium: "50329523139774375",
  });

  behavesLikeOTokens({
    name: "Call OTM",
    oTokenAddress: "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: ether("1480"),
    expiry: "1610697600",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: ether("0.1"),
    exerciseProfit: new BN("0"),
    premium: "18271767935676968",
  });

  behavesLikeOTokens({
    name: "Put OTM",
    oTokenAddress: "0x006583fEea92C695A9dE02C3AC2d4cd321f2F341",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    strikePrice: ether("800"),
    expiry: "1610697600",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: ether("0.1"),
    exerciseProfit: new BN("0"),
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
      this.scaleDecimals = (n) => n.div(new BN("10").pow(new BN("10")));

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
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
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
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("purchases with 0x exchange", async function () {
        const res = await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          this.zeroExOrder,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: ether("10"),
          }
        );

        const buyToken = await IERC20.at(this.apiResponse.buyTokenAddress);
        const sellToken = await IERC20.at(this.apiResponse.sellTokenAddress);

        assert.isAtLeast(
          (await buyToken.balanceOf(this.adapter.address)).toNumber(),
          parseInt(this.apiResponse.buyAmount)
        );
        assert.equal(await sellToken.balanceOf(this.adapter.address), "0");

        expectEvent(res, "Purchased", {
          caller: user,
          protocolName: web3.utils.sha3(this.protocolName),
          underlying: this.underlying,
          strikeAsset: this.strikeAsset,
          expiry: this.expiry,
          strikePrice: this.strikePrice,
          optionType: this.optionType.toString(),
          amount: this.scaleDecimals(this.purchaseAmount),
          premium: this.premium,
          optionID: "0",
        });
      });
    });

    describe("#exercise", () => {
      let snapshotId;

      beforeEach(async function () {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];

        // load the contract with collateralAsset
        await this.mockController.buyCollateral(this.oTokenAddress, {
          from: owner,
          value: ether("10"),
        });

        await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          this.zeroExOrder,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: ether("5"),
          }
        );
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("exercises otokens", async function () {
        if (new BN(this.exerciseProfit).isZero()) {
          return;
        }
        await time.increaseTo(this.expiry + 1);

        const res = await this.adapter.mockedExercise(
          this.oTokenAddress,
          0,
          this.purchaseAmount,
          user,
          { from: user }
        );

        expectEvent(res, "Exercised", {
          caller: user,
          options: this.oTokenAddress,
          optionID: "0",
          amount: this.purchaseAmount,
          exerciseProfit: "0",
        });

        const otoken = await IERC20.at(this.oTokenAddress);
        const collateralToken = await IERC20.at(this.collateralAsset);

        assert.equal((await otoken.balanceOf(user)).toString(), "0");
        assert.equal(
          (await otoken.balanceOf(this.adapter.address)).toString(),
          "0"
        );
        assert.equal(
          (await collateralToken.balanceOf(user)).toString(),
          this.exerciseProfit
        );
      });
    });
  });
}
