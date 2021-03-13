const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { provider, BigNumber, constants } = ethers;
const { parseEther } = ethers.utils;

const time = require("../helpers/time.js");
const {
  wmul,
  wdiv,
} = require("../helpers/utils");

const CHARM_OPTION_FACTORY = "";
const CHARM_OPTION_VIEW = "";

const WAD = BigNumber.from("10").pow(BigNumber.from("18"));

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.AddressZero;
const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
let owner, user, recipient;
let ownerSigner;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;


// NOTE: USE WITH BLOCKNUM 12032283 when FORKING

describe.skip("CharmAdapter", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [, ownerSigner, userSigner, recipientSigner] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    recipient = recipientSigner.address;

    // const MockGammaAdapter = await ethers.getContractFactory(
    //   "MockGammaAdapter",
    //   ownerSigner
    // );
    const CharmAdapter = await ethers.getContractFactory(
      "CharmAdapter",
      ownerSigner
    );
    // const MockGammaController = await ethers.getContractFactory(
    //   "MockGammaController",
    //   ownerSigner
    // );

    this.protocolName = "CHARM";
    this.nonFungible = false;

    // this.mockController = await MockGammaController.deploy(
    //   GAMMA_ORACLE,
    //   UNISWAP_ROUTER,
    //   WETH_ADDRESS
    // );
    //
    // this.mockController.setPrice("110000000000");
    //
    // this.gammaController = await ethers.getContractAt(
    //   "IController",
    //   GAMMA_CONTROLLER
    // );
    //
    // this.mockAdapter = (
    //   await MockGammaAdapter.deploy(OTOKEN_FACTORY, this.mockController.address)
    // ).connect(userSigner);

    this.adapter = (
      await CharmAdapter.deploy(CHARM_OPTION_FACTORY, CHARM_OPTION_VIEW)
    ).connect(userSigner);

    // this.oracle = await setupOracle(ownerSigner);

    // this.depositToVaultForShorts = depositToVaultForShorts;
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
      //Charm ETH 05FEB2021 960 C
      const oTokenAddress = "0x93e45f8D81ea99C1362D38f404112bd518049A21";

      await this.adapter.populateOTokenMappings();

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.AddressZero,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1612540800",
        parseEther("960"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualOTokenAddress, oTokenAddress);
    });

    it("looks up put oToken correctly", async function () {
      //Charm WBTC 26FEB2021 40000 P
      const oTokenAddress = "0xDb8AB49c916c3E2C6e9b56064F69f0d92AdfFB7f";

      await this.adapter.populateOTokenMappings();

      const actualOTokenAddress = await this.adapter.lookupOToken([
        WBTC_ADDRESS,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1614355200",
        parseEther("40000"),
        PUT_OPTION_TYPE,
        WBTC_ADDRESS,
      ]);

      assert.equal(actualOTokenAddress, oTokenAddress);
    });

    it("looks up invalid oToken correctly (change strike price)", async function () {
      await this.adapter.populateOTokenMappings();

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.AddressZero,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1612540800",
        parseEther("963"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualOTokenAddress, constants.AddressZero);
    });

    it("looks up oToken without populating mappings first", async function () {
      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.AddressZero,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1612540800",
        parseEther("960"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualOTokenAddress, constants.AddressZero);
    });
  });

  //Charm ETH 25JUN2021 480 C
  behavesLikeOTokens({
    name: "ETH CALL ITM",
    oTokenAddress: "0x50dBA362A22D1ab4b152F556D751Cb696ecCEefD",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("480"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("12727272727272727"),
    premium: "50587453335072052",
  });

  //Charm ETH 25JUN2021 4000 C
  behavesLikeOTokens({
    name: "ETH CALL OTM",
    oTokenAddress: "0x823884Aa887B97966dA9F9f13BD24f5548C5359B",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("4000"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "18292499493934936",
  });

  //Charm ETH 25JUN2021 4000 P
  behavesLikeOTokens({
    name: "ETH PUT ITM",
    oTokenAddress: "0xaa595806bbf24A1B1FD4e6ea3060F4bD3E80F61a",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("4000"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("12727272727272727"),
    premium: "50587453335072052",
  });

  //Charm ETH 25JUN2021 640 P
  behavesLikeOTokens({
    name: "ETH PUT OTM",
    oTokenAddress: "0xCbD1D4d55bA855451446D586760DEB6247c3bFAB",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("640"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "18292499493934936",
  });

  //Charm WBTC 25JUN2021 20000 C
  behavesLikeOTokens({
    name: "WBTC CALL ITM",
    oTokenAddress: "0x1aa6Df53Ef4f2f8464C4728C787906439483eB78",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("20000"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("12727272727272727"),
    premium: "50587453335072052",
  });

  //Charm WBTC 25JUN2021 80000 C
  behavesLikeOTokens({
    name: "WBTC CALL OTM",
    oTokenAddress: "0x9299b81cad5432333F9aceCb39c628Bf7240A1e2",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("80000"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "18292499493934936",
  });

  //Charm WBTC 25JUN2021 80000 P
  behavesLikeOTokens({
    name: "WBTC PUT ITM",
    oTokenAddress: "0x2DD26C5dbcDE2b45562939E5A915F0eA3AC74d51",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("80000"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("12727272727272727"),
    premium: "50587453335072052",
  });

  //Charm WBTC 25JUN2021 20000 P
  behavesLikeOTokens({
    name: "WBTC PUT OTM",
    oTokenAddress: "0x009DfeD0B46a990D327717946f09de4A95a7AA1B",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("20000"),
    // settlePrice: "120000000000",
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    // shortAmount: parseEther("1"),
    exerciseProfit: BigNumber.from("0"),
    premium: "18292499493934936",
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
        // shortAmount,
        premium,
        // settlePrice,
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
      // this.shortAmount = shortAmount;
      // this.settlePrice = settlePrice;
      // this.apiResponse = ZERO_EX_API_RESPONSES[oTokenAddress];
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

      await this.adapter.populateOTokenMappings();

      // this.zeroExOrder = [
      //   this.apiResponse.to,
      //   this.apiResponse.buyTokenAddress,
      //   this.apiResponse.sellTokenAddress,
      //   this.apiResponse.to,
      //   this.apiResponse.protocolFee,
      //   this.apiResponse.buyAmount,
      //   this.apiResponse.sellAmount,
      //   this.apiResponse.data,
      // ];
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

    describe("#purchase", () => {
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("reverts when not enough value is passed", async function () {
        const promise = this.adapter.purchase(
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
            value: this.premium.sub(BigNumber.from("1")),
          }
        );
        if (this.underlying === ETH_ADDRESS) {
          await expect(promise).to.be.revertedWith("Wrong value");
        } else {
          await expect(promise).to.be.reverted;
        }
      });

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
              value: this.premium,
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
              value: this.purchaseAmount,
            }
          )
        ).to.be.revertedWith("No matching options contract");
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
            value: this.premium,
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

        assert.isAtLeast(
          (await this.oToken.balanceOf(this.adapter.address)).toNumber(),
          parseInt(this.purchaseAmount)
        );
      });

      it("purchases twice", async function () {
        await this.adapter.purchase(
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
            value: this.premium,
          }
        );

        await this.adapter.purchase(
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
            value: this.premium,
          }
        );
      });
    });

    describe("#exercise", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await time.takeSnapshot();

        // Purchase
        await this.adapter.purchase(
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
            value: this.premium,
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

        const res = await this.adapter.exercise(
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

        if (this.collateralAsset == ETH_ADDRESS) {
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

      it.skip("can exercise", async function () {
        await time.increaseTo(this.expiry + 7201);

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

    // describe("#createShort", () => {
    //   time.revertToSnapshotAfterEach(async function () {
    //     await this.depositToVaultForShorts(parseEther("10"));
    //   });
    //
    //   it("reverts when no matched oToken", async function () {
    //     const optionTerms = [
    //       "0x0000000000000000000000000000000000000069",
    //       "0x0000000000000000000000000000000000000069",
    //       "0x0000000000000000000000000000000000000069",
    //       "1614326400",
    //       parseEther("800"),
    //       CALL_OPTION_TYPE,
    //       "0x0000000000000000000000000000000000000069",
    //     ];
    //
    //     await expect(
    //       this.adapter.createShort(optionTerms, this.shortAmount)
    //     ).to.be.revertedWith("Invalid oToken");
    //   });
    //
    //   it("reverts when depositing too little collateral for ETH", async function () {
    //     if (this.collateralAsset === WETH_ADDRESS) {
    //       await expect(
    //         this.adapter.createShort(this.optionTerms, 1)
    //       ).to.be.revertedWith(/Must deposit more than 10\*\*8 collateral/);
    //     }
    //   });
    //
    //   it("creates a short position", async function () {
    //     const collateral = await ethers.getContractAt(
    //       "IERC20",
    //       this.collateralAsset
    //     );
    //     const initialPoolCollateralBalance = await collateral.balanceOf(
    //       MARGIN_POOL
    //     );
    //
    //     assert.equal(
    //       await this.gammaController.getAccountVaultCounter(
    //         this.adapter.address
    //       ),
    //       "0"
    //     );
    //
    //     await this.adapter.createShort(this.optionTerms, this.shortAmount);
    //
    //     let oTokenMintedAmount;
    //
    //     if (this.optionType === CALL_OPTION_TYPE) {
    //       oTokenMintedAmount = this.shortAmount.div(
    //         BigNumber.from("10").pow(BigNumber.from("10"))
    //       );
    //     } else {
    //       oTokenMintedAmount = wdiv(this.shortAmount, this.strikePrice)
    //         .mul(BigNumber.from("10").pow(BigNumber.from("8")))
    //         .div(BigNumber.from("10").pow(BigNumber.from("6")));
    //     }
    //
    //     assert.equal(
    //       await this.gammaController.getAccountVaultCounter(
    //         this.adapter.address
    //       ),
    //       "1"
    //     );
    //
    //     assert.equal(
    //       (await this.oToken.balanceOf(this.adapter.address)).toString(),
    //       oTokenMintedAmount
    //     );
    //
    //     const endPoolCollateralBalance = await collateral.balanceOf(
    //       MARGIN_POOL
    //     );
    //     assert.equal(
    //       endPoolCollateralBalance.sub(initialPoolCollateralBalance).toString(),
    //       this.shortAmount
    //     );
    //   });
    // });

    // describe("#closeShort", () => {
    //   time.revertToSnapshotAfterEach(async function () {
    //     const ethDepositAmount = parseEther("10");
    //
    //     this.depositAmount = await this.depositToVaultForShorts(
    //       ethDepositAmount
    //     );
    //
    //     await this.adapter.createShort(this.optionTerms, this.shortAmount);
    //   });
    //
    //   it("burns otokens and withdraws original amount before expiry", async function () {
    //     const collateralToken = await ethers.getContractAt(
    //       "IERC20",
    //       this.collateralAsset
    //     );
    //
    //     assert.equal(
    //       (await collateralToken.balanceOf(this.adapter.address)).toString(),
    //       this.depositAmount.sub(this.shortAmount)
    //     );
    //
    //     await this.adapter.closeShort();
    //
    //     // the adapter should get back the collateral used to open the short
    //     assert.equal(
    //       (await collateralToken.balanceOf(this.adapter.address)).toString(),
    //       this.depositAmount.toString()
    //     );
    //   });
    //
    //   it("settles the vault and withdraws collateral after expiry", async function () {
    //     const collateralToken = await ethers.getContractAt(
    //       "IERC20",
    //       this.collateralAsset
    //     );
    //
    //     const startWETHBalance = await collateralToken.balanceOf(
    //       this.adapter.address
    //     );
    //
    //     await setOpynOracleExpiryPrice(
    //       this.oracle,
    //       this.expiry,
    //       this.settlePrice
    //     );
    //
    //     await this.adapter.closeShort();
    //
    //     const strike = this.strikePrice;
    //     const shortAmount = this.shortAmount;
    //
    //     const settlePrice = BigNumber.from(this.settlePrice).mul(
    //       BigNumber.from("10").pow(BigNumber.from("10"))
    //     );
    //
    //     const inTheMoney =
    //       this.optionType === CALL_OPTION_TYPE
    //         ? settlePrice.gt(strike)
    //         : settlePrice.lt(strike);
    //
    //     let shortOutcome;
    //
    //     if (inTheMoney) {
    //       // lose money when short option and ITM
    //       // settlePrice = 1200, strikePrice = 9600
    //       // loss = (1200-960)/1200
    //       // shortOutcome = shortAmount - loss = 0.8 ETH
    //
    //       const loss = settlePrice.sub(strike).mul(WAD).div(settlePrice);
    //       shortOutcome = shortAmount.sub(wmul(shortAmount, loss));
    //     } else {
    //       // If it's OTM, you will get back 100% of the collateral deposited
    //       shortOutcome = shortAmount;
    //     }
    //
    //     assert.equal(
    //       (await collateralToken.balanceOf(this.adapter.address))
    //         .sub(startWETHBalance)
    //         .toString(),
    //       shortOutcome
    //     );
    //   });
    // });

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

// async function depositToVaultForShorts(depositAmount) {
//   if (this.collateralAsset === WETH_ADDRESS) {
//     const wethContract = (
//       await ethers.getContractAt("IWETH", WETH_ADDRESS)
//     ).connect(ownerSigner);
//     await wethContract.deposit({ from: owner, value: depositAmount });
//     await wethContract.transfer(this.adapter.address, depositAmount, {
//       from: owner,
//     });
//
//     return depositAmount;
//   } else {
//     const router = (
//       await ethers.getContractAt("IUniswapV2Router01", UNISWAP_ROUTER)
//     ).connect(ownerSigner);
//     const collateralToken = (
//       await ethers.getContractAt("IERC20", this.collateralAsset)
//     ).connect(ownerSigner);
//
//     const amountsOut = await router.getAmountsOut(depositAmount, [
//       WETH_ADDRESS,
//       this.collateralAsset,
//     ]);
//
//     const amountOutMin = amountsOut[1];
//
//     const startBalance = await collateralToken.balanceOf(owner);
//
//     await router.swapExactETHForTokens(
//       amountOutMin,
//       [WETH_ADDRESS, this.collateralAsset],
//       owner,
//       Math.floor(Date.now() / 1000) + 69,
//       { from: owner, value: depositAmount }
//     );
//
//     const endBalance = await collateralToken.balanceOf(owner);
//
//     const depositedCollateralAmount = endBalance.sub(startBalance);
//
//     await collateralToken.transfer(
//       this.adapter.address,
//       depositedCollateralAmount,
//       {
//         from: owner,
//       }
//     );
//
//     return depositedCollateralAmount;
//   }
// }

// function calculateZeroExOrderCost(apiResponse) {
//   let decimals;
//
//   if (apiResponse.sellTokenAddress === USDC_ADDRESS.toLowerCase()) {
//     decimals = 10 ** 6;
//   } else if (apiResponse.sellTokenAddress === WETH_ADDRESS.toLowerCase()) {
//     return BigNumber.from(apiResponse.sellAmount);
//   } else {
//     decimals = 10 ** 18;
//   }
//
//   const scaledSellAmount = parseInt(apiResponse.sellAmount) / decimals;
//   const totalETH =
//     scaledSellAmount / parseFloat(apiResponse.sellTokenToEthRate);
//
//   return parseEther(totalETH.toPrecision(10)).add(
//     BigNumber.from(apiResponse.value)
//   );
// }
