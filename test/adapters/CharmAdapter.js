const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { provider, BigNumber, constants } = ethers;
const { parseEther, parseUnits, formatEther } = ethers.utils;

require("dotenv").config();

const time = require("../helpers/time.js");
const { wmul, wdiv } = require("../helpers/utils");

const CHARM_OPTION_VIEWS = "0x3cb5d4aeb622A72CF971D4F308e767C53be4E815";
const CHARM_OPTION_REGISTRY = "0x574467e54F1E145d0d1a9a96560a7704fEdAd1CD";

const WAD = BigNumber.from("10").pow(BigNumber.from("18"));

const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.AddressZero;
const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
let owner, user, recipient;
let ownerSigner;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("CharmAdapter", () => {
  let initSnapshotId;

  before(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.TEST_URI,
            blockNumber: 12071263,
          },
        },
      ],
    });

    initSnapshotId = await time.takeSnapshot();

    [, ownerSigner, userSigner, recipientSigner] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    recipient = recipientSigner.address;

    this.protocolName = "CHARM";
    this.nonFungible = false;

    const CharmAdapter = await ethers.getContractFactory(
      "CharmAdapter",
      ownerSigner
    );

    this.adapter = (
      await CharmAdapter.deploy(CHARM_OPTION_VIEWS, CHARM_OPTION_REGISTRY)
    ).connect(userSigner);

    this.optionRegistry = await ethers.getContractAt(
      "IOptionRegistry",
      CHARM_OPTION_REGISTRY
    );

    this.router = (
      await ethers.getContractAt("IUniswapV2Router01", UNISWAP_ROUTER)
    ).connect(ownerSigner);
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

  describe("#lookupCtoken", () => {
    time.revertToSnapshotAfterEach();
    it("looks up call cToken correctly", async function () {
      try {
        await this.optionRegistry.populateMarkets();
      } catch {}

      //Charm ETH 25JUN2021 480 C
      const cTokenAddress = "0x50dBA362A22D1ab4b152F556D751Cb696ecCEefD";

      const actualCTokenAddress = await this.adapter.lookupCToken([
        constants.AddressZero,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1624608000",
        parseEther("480"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualCTokenAddress, cTokenAddress);
    });

    it("looks up put cToken correctly", async function () {
      try {
        await this.optionRegistry.populateMarkets();
      } catch {}

      //Charm WBTC 25JUN2021 80000 P
      const cTokenAddress = "0x2DD26C5dbcDE2b45562939E5A915F0eA3AC74d51";

      const actualCTokenAddress = await this.adapter.lookupCToken([
        WBTC_ADDRESS,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1624608000",
        parseEther("80000"),
        PUT_OPTION_TYPE,
        WBTC_ADDRESS,
      ]);

      assert.equal(actualCTokenAddress, cTokenAddress);
    });

    it("looks up invalid cToken correctly (change strike price, expiry)", async function () {
      try {
        await this.optionRegistry.populateMarkets();
      } catch {}
      const actualCTokenAddress = await this.adapter.lookupCToken([
        constants.AddressZero,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1612540800",
        parseEther("963"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualCTokenAddress, constants.AddressZero);
    });
  });

  //Charm ETH 25JUN2021 480 C
  behavesLikeCTokens({
    name: "ETH CALL ITM",
    cTokenAddress: "0x0Ec2785765e673F3AB13A04D405F7C52e62AC6f3",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("640"),
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 1,
  });

  //Charm ETH 25JUN2021 4000 C
  behavesLikeCTokens({
    name: "ETH CALL OTM",
    cTokenAddress: "0x823884Aa887B97966dA9F9f13BD24f5548C5359B",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("4000"),
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 8,
  });

  //Charm ETH 25JUN2021 4000 P
  behavesLikeCTokens({
    name: "ETH PUT ITM",
    cTokenAddress: "0xaa595806bbf24A1B1FD4e6ea3060F4bD3E80F61a",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("4000"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 8,
  });

  //Charm ETH 25JUN2021 640 P
  behavesLikeCTokens({
    name: "ETH PUT OTM",
    cTokenAddress: "0xCbD1D4d55bA855451446D586760DEB6247c3bFAB",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("640"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 1,
  });

  //Charm WBTC 25JUN2021 20000 C
  behavesLikeCTokens({
    name: "WBTC CALL ITM",
    cTokenAddress: "0x1aa6Df53Ef4f2f8464C4728C787906439483eB78",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("20000"),
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 1,
  });

  //Charm WBTC 25JUN2021 80000 C
  behavesLikeCTokens({
    name: "WBTC CALL OTM",
    cTokenAddress: "0x9299b81cad5432333F9aceCb39c628Bf7240A1e2",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("80000"),
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 7,
  });

  //Charm WBTC 25JUN2021 80000 P
  behavesLikeCTokens({
    name: "WBTC PUT ITM",
    cTokenAddress: "0x2DD26C5dbcDE2b45562939E5A915F0eA3AC74d51",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("80000"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 7,
  });

  //Charm WBTC 25JUN2021 20000 P
  behavesLikeCTokens({
    name: "WBTC PUT OTM",
    cTokenAddress: "0x009DfeD0B46a990D327717946f09de4A95a7AA1B",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("20000"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 1,
  });
});

function behavesLikeCTokens(params) {
  describe(`${params.name}`, () => {
    before(async function () {
      const {
        underlying,
        strikeAsset,
        collateralAsset,
        strikePrice,
        expiry,
        optionType,
        cTokenAddress,
        purchaseAmount,
        strikeIndex,
        maxCost,
      } = params;

      this.cTokenAddress = cTokenAddress;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.collateralAsset = collateralAsset;
      this.strikePrice = strikePrice;
      this.expiry = expiry;
      this.optionType = optionType;
      this.purchaseAmount = purchaseAmount;
      this.strikeIndex = strikeIndex;
      this.paymentToken =
        this.optionType == PUT_OPTION_TYPE ? this.strikeAsset : this.underlying;
      this.cToken = await ethers.getContractAt("IERC20", cTokenAddress);

      this.optionViews = await ethers.getContractAt(
        "IOptionViews",
        CHARM_OPTION_VIEWS
      );
      this.market = await (
        await ethers.getContractAt("IOptionToken", cTokenAddress)
      ).market();
      this.marketContract = await await ethers.getContractAt(
        "IOptionMarket",
        this.market
      );
      this.donor = "0x875abe6F1E2Aba07bED4A3234d8555A0d7656d12";

      this.shiftedPurchaseAmount = this.purchaseAmount;
      if (this.paymentToken == USDC_ADDRESS) {
        this.shiftedPurchaseAmount = parseUnits(
          formatEther(this.shiftedPurchaseAmount.toString()).toString(),
          6
        );
      } else if (this.paymentToken == WBTC_ADDRESS) {
        this.shiftedPurchaseAmount = parseUnits(
          formatEther(this.shiftedPurchaseAmount.toString()).toString(),
          8
        );
      }

      this.baseTokenPremium = (
        await this.optionViews.getBuyOptionCost(
          this.market,
          this.collateralAsset == ONE_ADDRESS ? true : false,
          this.strikeIndex,
          this.shiftedPurchaseAmount
        )
      ).toString();

      this.premium =
        this.paymentToken == ETH_ADDRESS
          ? this.baseTokenPremium
          : (
              await this.router.getAmountsOut(this.baseTokenPremium, [
                this.paymentToken,
                WETH_ADDRESS,
              ])
            )[1];

      this.premiumBuffered =
        this.paymentToken == ETH_ADDRESS
          ? this.premium
          : this.premium
              .mul(BigNumber.from("1100"))
              .div(BigNumber.from("1000"));

      console.log("the premium is %s", this.premium);
      this.maxCost = this.maxCost || parseEther("9999999999");

      this.optionTerms = [
        this.underlying,
        this.strikeAsset,
        this.collateralAsset,
        this.expiry,
        this.strikePrice,
        this.optionType,
        this.paymentToken,
      ];

      try {
        await this.optionRegistry.populateMarkets();
      } catch {}
    });

    describe("#premium", () => {
      time.revertToSnapshotAfterEach();
      it("gets premium of option", async function () {
        assert.equal(
          (
            await this.adapter.premium(this.optionTerms, this.purchaseAmount)
          ).toString(),
          this.baseTokenPremium
        );
      });
    });

    describe("#exerciseProfit", () => {
      time.revertToSnapshotAfterEach();

      it("gets exercise profit", async function () {
        const res = await this.adapter.purchase(
          [
            this.underlying,
            this.strikeAsset,
            this.collateralAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.paymentToken,
          ],
          this.purchaseAmount,
          this.maxCost,
          {
            from: user,
            value: this.premiumBuffered,
          }
        );

        await time.increaseTo(this.expiry + 1);

        await this.marketContract.settle();

        // For getting expiry exerciseProfit
        this.exerciseProfit = 0;

        try {
          this.exerciseProfit = (
            await this.optionViews.getSellOptionCost(
              this.market,
              this.collateralAsset == ONE_ADDRESS ? true : false,
              this.strikeIndex,
              this.shiftedPurchaseAmount
            )
          ).toString();
        } catch {}

        assert.equal(
          (
            await this.adapter.exerciseProfit(
              this.cTokenAddress,
              0,
              this.purchaseAmount
            )
          ).toString(),
          this.exerciseProfit
        );

        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed, 1400900);
      });

      it("gets exercise profit when not settled", async function () {
        const res = await this.adapter.purchase(
          [
            this.underlying,
            this.strikeAsset,
            this.collateralAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.paymentToken,
          ],
          this.purchaseAmount,
          this.maxCost,
          {
            from: user,
            value: this.premiumBuffered,
          }
        );

        await time.increaseTo(this.expiry + 1);

        // For getting expiry exerciseProfit
        this.exerciseProfit = 0;

        assert.equal(
          (
            await this.adapter.exerciseProfit(
              this.cTokenAddress,
              0,
              this.purchaseAmount
            )
          ).toString(),
          this.exerciseProfit
        );

        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed, 1400900);
      });
    });

    describe("#purchase", () => {
      time.revertToSnapshotAfterEach();

      it("reverts when buying after expiry", async function () {
        await time.increaseTo(this.expiry + 1);

        await expect(
          this.adapter.purchase(
            [
              this.underlying,
              this.strikeAsset,
              this.collateralAsset,
              this.expiry,
              this.strikePrice,
              this.optionType,
              this.paymentToken,
            ],
            this.purchaseAmount,
            this.maxCost,
            {
              from: user,
              value: this.premiumBuffered,
            }
          )
        ).to.be.revertedWith("Cannot purchase after expiry");
      });

      it("reverts when passing unknown underlying", async function () {
        await expect(
          this.adapter.purchase(
            [
              "0x0000000000000000000000000000000000000001",
              this.strikeAsset,
              this.collateralAsset,
              this.expiry,
              this.strikePrice,
              this.optionType,
              this.paymentToken,
            ],
            this.purchaseAmount,
            this.maxCost,
            {
              from: user,
              value: this.premiumBuffered,
            }
          )
        ).to.be.reverted;
      });

      it("purchase mints us tokens", async function () {
        const res = await this.adapter.purchase(
          [
            this.underlying,
            this.strikeAsset,
            this.collateralAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.paymentToken,
          ],
          this.purchaseAmount,
          this.maxCost,
          {
            from: user,
            value: this.premiumBuffered,
          }
        );

        expect(res)
          .to.emit(this.adapter, "Purchased")
          .withArgs(
            user,
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CHARM")),
            this.underlying,
            this.premium,
            0
          );

        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed, 1400900);

        assert.isAtLeast(
          parseInt(await this.cToken.balanceOf(this.adapter.address)),
          parseInt(this.shiftedPurchaseAmount)
        );
      });

      it("purchases twice", async function () {
        const res = await this.adapter.purchase(
          [
            this.underlying,
            this.strikeAsset,
            this.collateralAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.paymentToken,
          ],
          this.purchaseAmount,
          this.maxCost,
          {
            from: user,
            value: this.premiumBuffered,
          }
        );

        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed, 1400900);

        baseTokenPremium = (
          await this.optionViews.getBuyOptionCost(
            this.market,
            this.collateralAsset == ONE_ADDRESS ? true : false,
            this.strikeIndex,
            this.shiftedPurchaseAmount
          )
        ).toString();

        // Premium will change after first one bought
        premium =
          this.paymentToken == ETH_ADDRESS
            ? baseTokenPremium
            : (
                await this.router.getAmountsOut(baseTokenPremium, [
                  this.paymentToken,
                  WETH_ADDRESS,
                ])
              )[1];

        premiumBuffered =
          this.paymentToken == ETH_ADDRESS
            ? premium
            : premium.mul(BigNumber.from("1100")).div(BigNumber.from("1000"));

        const res2 = await this.adapter.purchase(
          [
            this.underlying,
            this.strikeAsset,
            this.collateralAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.paymentToken,
          ],
          this.purchaseAmount,
          this.maxCost,
          {
            from: user,
            value: premiumBuffered,
          }
        );

        const receipt2 = await res2.wait();
        assert.isAtMost(receipt2.gasUsed, 1400900);
      });
    });

    describe("#exercise", () => {
      time.revertToSnapshotAfterEach();

      it("exercises ctokens", async function () {
        // Purchase
        const res = await this.adapter.purchase(
          [
            this.underlying,
            this.strikeAsset,
            this.collateralAsset,
            this.expiry,
            this.strikePrice,
            this.optionType,
            this.paymentToken,
          ],
          this.purchaseAmount,
          this.maxCost,
          {
            from: user,
            value: this.premiumBuffered,
          }
        );

        const recipientStartBalance = await provider.getBalance(recipient);

        await time.increaseTo(this.expiry + 1);

        await this.marketContract.settle();

        // For getting expiry exerciseProfit
        this.exerciseProfit = 0;

        try {
          profitInBaseToken = (
            await this.optionViews.getSellOptionCost(
              this.market,
              this.collateralAsset == ONE_ADDRESS ? true : false,
              this.strikeIndex,
              this.shiftedPurchaseAmount
            )
          ).toString();
          console.log(
            "exercise profit is %s (in base token)",
            profitInBaseToken
          );
          this.exerciseProfit =
            this.paymentToken == ETH_ADDRESS
              ? profitInBaseToken
              : (
                  await this.router.getAmountsOut(profitInBaseToken, [
                    this.paymentToken,
                    WETH_ADDRESS,
                  ])
                )[1];
        } catch {}

        console.log(
          "actual exercise profit is %s (in eth)",
          this.exerciseProfit
        );

        if (BigNumber.from(this.exerciseProfit).isZero()) {
          return;
        }

        const receipt = await res.wait();
        assert.isAtMost(receipt.gasUsed, 1400900);

        const res2 = await this.adapter.exercise(
          this.cTokenAddress,
          0,
          this.purchaseAmount,
          recipient,
          { from: user }
        );

        expect(res2)
          .to.emit(this.adapter, "Exercised")
          .withArgs(
            user,
            this.cTokenAddress,
            "0",
            this.shiftedPurchaseAmount,
            this.exerciseProfit
          );

        const ctoken = await ethers.getContractAt("IERC20", this.cTokenAddress);

        assert.equal((await ctoken.balanceOf(user)).toString(), "0");
        assert.equal(
          (await ctoken.balanceOf(this.adapter.address)).toString(),
          "0"
        );

        assert.equal(
          (await provider.getBalance(recipient))
            .sub(recipientStartBalance)
            .toString(),
          this.exerciseProfit
        );
      });
    });

    describe("#canExercise", () => {
      time.revertToSnapshotAfterEach();

      it.skip("can exercise", async function () {
        await time.increaseTo(this.expiry + 7201);
        await this.marketContract.settle();

        const res = await this.adapter.canExercise(
          this.cTokenAddress,
          0,
          this.purchaseAmount
        );

        // For getting expiry exerciseProfit
        this.exerciseProfit = 0;

        try {
          this.exerciseProfit = (
            await this.optionViews.getSellOptionCost(
              this.market,
              this.collateralAsset == ONE_ADDRESS ? true : false,
              this.strikeIndex,
              this.shiftedPurchaseAmount
            )
          ).toString();
        } catch {}

        if (this.exerciseProfit.isZero()) {
          assert.isFalse(res);
          return;
        }

        assert.isTrue(res);
      });

      it("cannot exercise before expiry", async function () {
        const res = await this.adapter.canExercise(
          this.cTokenAddress,
          0,
          this.purchaseAmount
        );
        assert.isFalse(res);
      });
    });

    describe("#getOptionsAddress", () => {
      it("returns the correct ctoken address", async function () {
        assert.equal(
          await this.adapter.getOptionsAddress(this.optionTerms),
          this.cTokenAddress
        );
      });
    });
  });
}

/*
async function depositAndApprove(fromAddress, toAddress, tokenAddress, approveAddress) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [fromAddress]}
  )
  const signer = await ethers.provider.getSigner(fromAddress);
  token = await ethers.getContractAt("IERC20", tokenAddress);
  let withSigner = await token.connect(signer);
  let amount = await withSigner.balanceOf(fromAddress);
  await withSigner.transfer(toAddress, amount);
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [toAddress]}
  )
  const signer2 = await ethers.provider.getSigner(toAddress);
  token2 = await ethers.getContractAt("IERC20", tokenAddress);
  let withSigner2 = await token2.connect(signer2);
  await withSigner2.approve(approveAddress, amount);
}
*/
