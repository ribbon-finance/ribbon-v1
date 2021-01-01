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
const OpynV1Adapter = contract.fromArtifact("OpynV1Adapter");
const MockDojiFactory = contract.fromArtifact("MockDojiFactory");
const IERC20 = contract.fromArtifact("IERC20");
const IOToken = contract.fromArtifact("IOToken");
const IOptionsExchange = contract.fromArtifact("IOptionsExchange");
const IUniswapFactory = contract.fromArtifact("IUniswapFactory");
const UniswapExchangeInterface = contract.fromArtifact(
  "UniswapExchangeInterface"
);
const helper = require("../helper.js");

const AAVE_ADDRESS_PROVIDER = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const UNI_ADDRESS = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const YFI_ADDRESS = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e";

const [admin, owner, user] = accounts;
const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
const ETH_ADDRESS = constants.ZERO_ADDRESS;

describe("OpynV1Adapter", () => {
  let initSnapshotId;

  before(async function () {
    // we assume the user account is the calling instrument
    this.factory = await MockDojiFactory.new({ from: owner });
    await this.factory.initialize(owner, admin, { from: owner });
    await this.factory.setInstrument(user, { from: user });

    this.adapter = await OpynV1Adapter.new(AAVE_ADDRESS_PROVIDER, {
      from: owner,
    });
    await this.adapter.initialize(
      owner,
      this.factory.address,
      AAVE_ADDRESS_PROVIDER,
      UNISWAP_ROUTER,
      WETH_ADDRESS,
      { from: owner }
    );

    // test cases
    this.protocolName = "OPYN_V1";
    this.nonFungible = false;
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
  });

  describe("#setVaults", () => {
    it("reverts when not owner", async function () {
      await expectRevert(
        this.adapter.setVaults(
          constants.ZERO_ADDRESS,
          [constants.ZERO_ADDRESS],
          {
            from: user,
          }
        ),
        "only owner"
      );
    });
  });

  /**
   * Current price for ETH-USD = ~$545
   * Current price for UNI-USD = $3.35
   * Current price for BTC-USD = ~$18,000
   * Current price for YFI-USD = ~$25,500
   * Date is 9 December 2020
   */

  // ETH Options
  behavesLikeOToken({
    oTokenName: "ETH CALL ITM",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    expiry: "1608883200",
    oTokenAddress: "0xb759e6731df19abD72e0456184890f87dCb6C518",
    optionType: CALL_OPTION_TYPE,
    strikePrice: ether("500"),
    premium: new BN("106656198359758724"),
    purchaseAmount: ether("500"),
    scaledPurchaseAmount: new BN("500000000"),
    exerciseProfitWithoutFees: new BN("1000000000000000000"),
    exerciseProfit: new BN("83090832707945605"),
    vaults: [
      "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
      "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
    ],
  });

  behavesLikeOToken({
    oTokenName: "ETH CALL OTM",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    expiry: "1608883200",
    oTokenAddress: "0x7EB6Dd0Cc2DF2EAe901f76A151cA82BB7be10d68",
    optionType: CALL_OPTION_TYPE,
    strikePrice: ether("640"),
    premium: new BN("22636934749846005"),
    purchaseAmount: ether("640"),
    scaledPurchaseAmount: new BN("640000000"),
    exerciseProfitWithoutFees: new BN("0"),
    exerciseProfit: new BN("0"),
    vaults: [
      "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
      "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
    ],
  });

  behavesLikeOToken({
    oTokenName: "ETH PUT ITM",
    underlying: WETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    expiry: "1608278400",
    oTokenAddress: "0xef99E80D6963D801B1f2b4c61F780082D2642152",
    optionType: PUT_OPTION_TYPE,
    strikePrice: ether("600"),
    premium: new BN("106920070230577145"),
    purchaseAmount: ether("1"),
    scaledPurchaseAmount: new BN("10000000"),
    exerciseProfitWithoutFees: new BN("1092696150697474033"),
    exerciseProfit: new BN("91796148075270874"),
    vaults: [
      "0x076c95c6cd2eb823acc6347fdf5b3dd9b83511e4",
      "0x099ebcc539828ff4ced12c0eb3b4b2ece558fdb5",
    ],
  });

  behavesLikeOToken({
    oTokenName: "ETH PUT OTM",
    underlying: WETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    expiry: "1608883200",
    oTokenAddress: "0x77fe93a60A579E4eD52159aE711794C6fb7CdeA7",
    optionType: PUT_OPTION_TYPE,
    strikePrice: ether("520"),
    premium: new BN("38993035115930594"),
    purchaseAmount: ether("1"),
    scaledPurchaseAmount: new BN("10000000"),
    exerciseProfitWithoutFees: new BN("0"),
    exerciseProfit: new BN("0"),
    vaults: [
      "0x076c95c6cd2eb823acc6347fdf5b3dd9b83511e4",
      "0x099ebcc539828ff4ced12c0eb3b4b2ece558fdb5",
    ],
  });

  // WBTC Options
  behavesLikeOToken({
    oTokenName: "WBTC CALL OTM",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    expiry: "1608883200",
    oTokenAddress: "0xDA4c285Ce9796Fb4c35f99d6066ce11ec18Ec4Cc",
    optionType: CALL_OPTION_TYPE,
    strikePrice: ether("20000"),
    premium: new BN("2406141839973257206"),
    purchaseAmount: ether("20000"),
    scaledPurchaseAmount: new BN("20000000"),
    exerciseProfitWithoutFees: new BN("0"),
    exerciseProfit: new BN("0"),
    vaults: [
      "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
      "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
    ],
  });

  behavesLikeOToken({
    oTokenName: "UNI PUT ITM",
    underlying: UNI_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    expiry: "1608883200",
    oTokenAddress: "0x9E22B1c5804F7aC179b77De79a32e458A0ECb651",
    optionType: PUT_OPTION_TYPE,
    strikePrice: ether("3.5"),
    premium: new BN("60713311014396049"),
    purchaseAmount: ether("100"),
    scaledPurchaseAmount: new BN("1000000000"),
    exerciseProfitWithoutFees: new BN("105167250869224019654"),
    exerciseProfit: new BN("6895291786998639829"),
    vaults: [
      "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
      "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
    ],
  });
});

function behavesLikeOToken(args) {
  const gasPrice = web3.utils.toWei("10", "gwei");

  describe(`oToken ${args.oTokenName}`, () => {
    before(async function () {
      const {
        underlying,
        strikeAsset,
        expiry,
        oTokenAddress,
        optionType,
        strikePrice,
        premium,
        purchaseAmount,
        scaledPurchaseAmount,
        exerciseProfit,
        vaults,
        exerciseProfitWithoutFees,
      } = args;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.expiry = expiry;
      this.strikePrice = strikePrice;
      this.premium = premium;
      this.oTokenAddress = oTokenAddress;
      this.optionType = optionType;
      this.purchaseAmount = purchaseAmount;
      this.scaledPurchaseAmount = scaledPurchaseAmount;
      this.exerciseProfit = exerciseProfit;
      this.exerciseProfitWithoutFees = exerciseProfitWithoutFees;
      this.vaults = vaults;

      this.oToken = await IERC20.at(this.oTokenAddress);
      await this.adapter.setOTokenWithTerms(
        this.strikePrice,
        this.optionType,
        this.oToken.address,
        { from: owner }
      );

      const oTokenContract = await IOToken.at(this.oTokenAddress);
      const optionsExchange = await IOptionsExchange.at(
        await oTokenContract.optionsExchange()
      );
      const uniswapFactory = await IUniswapFactory.at(
        await optionsExchange.UNISWAP_FACTORY()
      );
      this.uniswapExchange = await UniswapExchangeInterface.at(
        await uniswapFactory.getExchange(this.oTokenAddress)
      );

      const snapShot = await helper.takeSnapshot();
      initSnapshotId = snapShot["result"];
    });

    describe("#lookupOToken", () => {
      it("looks up the oToken with option terms", async function () {
        assert.equal(
          await this.adapter.lookupOToken(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType
          ),
          this.oToken.address
        );
      });
    });

    describe("#premium", () => {
      it("gets the premium for the option", async function () {
        assert.equal(
          (
            await this.adapter.premium(
              this.underlying,
              this.strikeAsset,
              this.expiry,
              this.strikePrice,
              this.optionType,
              this.purchaseAmount
            )
          ).toString(),
          this.premium.toString()
        );
      });
    });

    describe("#exerciseProfit", () => {
      let initSnapshotId;

      before(async function () {
        const snapshot = await helper.takeSnapshot();
        initSnapshotId = snapshot["result"];

        await this.adapter.purchase(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          this.optionType,
          this.purchaseAmount,
          {
            from: user,
            value: new BN(this.premium),
          }
        );
      });

      after(async () => {
        await helper.revertToSnapShot(initSnapshotId);
      });

      it("gets the exercise profit", async function () {
        assert.equal(
          (
            await this.adapter.exerciseProfit(
              this.oToken.address,
              0,
              this.scaledPurchaseAmount,
              this.underlying
            )
          ).toString(),
          this.exerciseProfitWithoutFees
        );
      });
    });

    describe("#purchase", () => {
      let snapshotId;

      beforeEach(async () => {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("reverts when not enough value passed", async function () {
        await expectRevert(
          this.adapter.purchase(
            this.underlying,
            this.strikeAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.purchaseAmount,
            { from: user, value: new BN(this.premium).sub(new BN("1")) }
          ),
          "Value does not cover cost."
        );
      });

      it("returns the change if user passes extra value", async function () {
        const userTracker = await balance.tracker(user, "wei");

        const res = await this.adapter.purchase(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          this.optionType,
          this.purchaseAmount,
          {
            from: user,
            gasPrice,
            value: new BN(this.premium).add(new BN("1")),
          }
        );
        const gasUsed = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));

        // returns the extra 1 wei back to the user
        assert.equal(
          (await userTracker.delta()).toString(),
          new BN(this.premium).add(gasUsed).neg().toString()
        );
      });

      it("purchases the oTokens", async function () {
        const startExchangeBalance = await this.oToken.balanceOf(
          this.uniswapExchange.address
        );

        const res = await this.adapter.purchase(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          this.optionType,
          this.purchaseAmount,
          { from: user, value: this.premium }
        );

        expectEvent(res, "Purchased", {
          caller: user,
          underlying: this.underlying,
          strikeAsset: this.strikeAsset,
          expiry: this.expiry.toString(),
          strikePrice: this.strikePrice,
          optionType: this.optionType.toString(),
          amount: this.scaledPurchaseAmount,
          premium: this.premium,
          optionID: "0",
        });

        assert.equal(
          (await this.oToken.balanceOf(this.adapter.address)).toString(),
          this.scaledPurchaseAmount
        );
        assert.equal((await this.oToken.balanceOf(user)).toString(), "0");
        assert.equal(
          (
            await this.oToken.balanceOf(this.uniswapExchange.address)
          ).toString(),
          startExchangeBalance.sub(this.scaledPurchaseAmount)
        );
      });
    });

    describe("#exercise", () => {
      let snapshotId;

      beforeEach(async function () {
        await this.adapter.purchase(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          this.optionType,
          this.purchaseAmount,
          { from: user, value: this.premium }
        );

        await this.adapter.setVaults(this.oToken.address, this.vaults, {
          from: owner,
        });

        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("exercises tokens", async function () {
        await this.oToken.approve(
          this.adapter.address,
          this.scaledPurchaseAmount,
          {
            from: user,
          }
        );

        const userTracker = await balance.tracker(user);
        let token, startUserBalance;
        if (this.underlying !== ETH_ADDRESS) {
          token = await IERC20.at(this.underlying);
          startUserBalance = await token.balanceOf(user);
        }

        const promise = this.adapter.exercise(
          this.oToken.address,
          0,
          this.purchaseAmount,
          this.underlying,
          user,
          {
            from: user,
            gasPrice,
          }
        );

        if (this.exerciseProfit.isZero()) {
          await expectRevert(promise, "Not enough collateral to swap");
          return;
        }

        if (this.underlying === ETH_ADDRESS) {
          const res = await promise;
          const gasUsed = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));
          const balanceChange = await userTracker.delta();

          assert.equal(
            balanceChange.toString(),
            this.exerciseProfit.sub(gasUsed).toString()
          );
        } else {
          assert.equal(
            (await token.balanceOf(user)).sub(startUserBalance).toString(),
            this.exerciseProfit
          );
          assert.equal(
            (await token.balanceOf(this.adapter.address)).toString(),
            "0"
          );
        }

        // adapter should not hold anything at the end
        const strikeERC20 = await IERC20.at(this.strikeAsset);
        assert.equal(await balance.current(this.adapter.address), "0");
        assert.equal(await this.oToken.balanceOf(this.adapter.address), "0");
        assert.equal(await strikeERC20.balanceOf(this.adapter.address), "0");
      });
    });
  });
}
