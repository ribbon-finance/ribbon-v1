const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { provider, BigNumber, constants } = ethers;
const { parseEther } = ethers.utils;

const time = require("../helpers/time.js");
const {
  wmul,
  wdiv,
} = require("../helpers/utils");

const CHARM_OPTION_FACTORY = "0xCDFE169dF3D64E2e43D88794A21048A52C742F2B";
const CHARM_OPTION_VIEWS = "0x3cb5d4aeb622A72CF971D4F308e767C53be4E815";

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


// NOTE: USE WITH BLOCKNUM 12039266 when FORKING

describe("CharmAdapter", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [, ownerSigner, userSigner, recipientSigner] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;
    recipient = recipientSigner.address;

    const CharmAdapter = await ethers.getContractFactory(
      "CharmAdapter",
      ownerSigner
    );

    const AdapterStorage = await ethers.getContractFactory(
      "AdapterStorage",
      ownerSigner
    );

    const MockRibbonFactory = await ethers.getContractFactory(
      "MockRibbonFactory",
      ownerSigner
    );

    this.protocolName = "CHARM";
    this.nonFungible = false;

    this.mockRibbonFactory = await MockRibbonFactory.deploy();

    this.adapterStorage = await AdapterStorage.deploy(this.mockRibbonFactory.address);

    this.adapter = (
      await CharmAdapter.deploy(
        CHARM_OPTION_FACTORY,
        CHARM_OPTION_VIEWS,
        this.adapterStorage.address
      )
    ).connect(userSigner);

    await this.mockRibbonFactory.setInstrument(this.adapter.address);
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
      //Charm ETH 25JUN2021 480 C
      const oTokenAddress = "0x50dBA362A22D1ab4b152F556D751Cb696ecCEefD";

      await this.adapter.populateOTokenMappings();

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.AddressZero,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1624608000",
        parseEther("480"),
        CALL_OPTION_TYPE,
        constants.AddressZero,
      ]);

      assert.equal(actualOTokenAddress, oTokenAddress);
    });

    it("looks up put oToken correctly", async function () {
      //Charm WBTC 25JUN2021 80000 P
      const oTokenAddress = "0x2DD26C5dbcDE2b45562939E5A915F0eA3AC74d51";

      await this.adapter.populateOTokenMappings();

      const actualOTokenAddress = await this.adapter.lookupOToken([
        WBTC_ADDRESS,
        USDC_ADDRESS,
        ONE_ADDRESS,
        "1624608000",
        parseEther("80000"),
        PUT_OPTION_TYPE,
        WBTC_ADDRESS,
      ]);

      assert.equal(actualOTokenAddress, oTokenAddress);
    });

    it("looks up invalid oToken correctly (change strike price, expiry)", async function () {
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

    it("looks up oToken correctly after 2 populateOTokenMappings", async function () {
      await this.adapter.populateOTokenMappings();
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
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: parseEther("0.1"),
    strikeIndex: 0,
  });

  //Charm ETH 25JUN2021 4000 C
  behavesLikeOTokens({
    name: "ETH CALL OTM",
    oTokenAddress: "0x823884Aa887B97966dA9F9f13BD24f5548C5359B",
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
  behavesLikeOTokens({
    name: "ETH PUT ITM",
    oTokenAddress: "0xaa595806bbf24A1B1FD4e6ea3060F4bD3E80F61a",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("4000"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: BigNumber.from("10000000"),
    strikeIndex: 8,
  });

  //Charm ETH 25JUN2021 640 P
  behavesLikeOTokens({
    name: "ETH PUT OTM",
    oTokenAddress: "0xCbD1D4d55bA855451446D586760DEB6247c3bFAB",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("640"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: BigNumber.from("10000000"),
    strikeIndex: 1,
  });

  //Charm WBTC 25JUN2021 20000 C
  behavesLikeOTokens({
    name: "WBTC CALL ITM",
    oTokenAddress: "0x1aa6Df53Ef4f2f8464C4728C787906439483eB78",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("20000"),
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: BigNumber.from("100000000"),
    strikeIndex: 1,
  });

  //Charm WBTC 25JUN2021 80000 C
  behavesLikeOTokens({
    name: "WBTC CALL OTM",
    oTokenAddress: "0x9299b81cad5432333F9aceCb39c628Bf7240A1e2",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("80000"),
    expiry: "1624608000",
    optionType: CALL_OPTION_TYPE,
    purchaseAmount: BigNumber.from("100000000"),
    strikeIndex: 7,
  });

  //Charm WBTC 25JUN2021 80000 P
  behavesLikeOTokens({
    name: "WBTC PUT ITM",
    oTokenAddress: "0x2DD26C5dbcDE2b45562939E5A915F0eA3AC74d51",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("80000"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: BigNumber.from("1000000"),
    strikeIndex: 7,
  });

  //Charm WBTC 25JUN2021 20000 P
  behavesLikeOTokens({
    name: "WBTC PUT OTM",
    oTokenAddress: "0x009DfeD0B46a990D327717946f09de4A95a7AA1B",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ONE_ADDRESS,
    strikePrice: parseEther("20000"),
    expiry: "1624608000",
    optionType: PUT_OPTION_TYPE,
    purchaseAmount: BigNumber.from("1000000"),
    strikeIndex: 1,
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
        strikeIndex,
        maxCost,
      } = params;

      this.oTokenAddress = oTokenAddress;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.collateralAsset = collateralAsset;
      this.strikePrice = strikePrice;
      this.expiry = expiry;
      this.optionType = optionType;
      this.purchaseAmount = purchaseAmount;
      this.strikeIndex = strikeIndex;
      this.paymentToken = this.optionType == PUT_OPTION_TYPE ? this.strikeAsset : this.underlying;

      this.oToken = await ethers.getContractAt("IERC20", oTokenAddress);

      this.optionViews = await ethers.getContractAt("IOptionViews", CHARM_OPTION_VIEWS);
      this.market = await (await ethers.getContractAt("IOptionToken", oTokenAddress)).market();
      this.donor = "0x875abe6F1E2Aba07bED4A3234d8555A0d7656d12";

      this.premium = await this.optionViews.getBuyOptionCost(this.market, this.collateralAsset == ONE_ADDRESS ? true : false, this.strikeIndex, this.purchaseAmount);
      this.maxCost = this.maxCost || parseEther("9999999999");

      // For getting expiry exerciseProfit
      snapshotId = await time.takeSnapshot();
      await time.increaseTo(this.expiry + 1);
      this.exerciseProfit = 0;

      try {
        this.exerciseProfit = (await this.optionViews.getSellOptionCost(this.market, this.collateralAsset == ONE_ADDRESS ? true : false, this.strikeIndex, this.purchaseAmount)).toString();
      } catch {}

      await time.revertToSnapShot(snapshotId);

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

      // console.log("this.underlying is %s", this.underlying);
      // console.log("this.strikeAsset is %s", this.strikeAsset);
      // console.log("this.collateralAsset is %s", this.collateralAsset);
      // console.log("this.expiry is %s", this.expiry);
      // console.log("this.strikePrice is %s", this.strikePrice);
      // console.log("this.optionType is %s", this.optionType);
      // console.log("this.paymentToken is %s", this.paymentToken);
      // console.log("this.purchaseAmount is %s", this.purchaseAmount);
      // console.log("this.maxCost is %s", this.maxCost);
      // console.log("user is %s", user);
      // console.log("this.premium is %s", this.premium);
    });

    describe("#premium", () => {
      it("gets premium of option", async function () {
        assert.equal(
          (await this.adapter.premium(this.optionTerms, this.purchaseAmount)).toString(),
          this.premium
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
        await depositAndApprove(this.donor, user, USDC_ADDRESS, this.adapter.address);
        await depositAndApprove(this.donor, user, WBTC_ADDRESS, this.adapter.address);
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
              )

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
        ).to.be.reverted;
      });

      it("purchase mints us tokens", async function () {
        await depositAndApprove(this.donor, user, USDC_ADDRESS, this.adapter.address);
        await depositAndApprove(this.donor, user, WBTC_ADDRESS, this.adapter.address);
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
          parseInt(await this.oToken.balanceOf(this.adapter.address)),
          parseInt(this.purchaseAmount)
        );
      });

      it("purchases twice", async function () {
        await depositAndApprove(this.donor, user, USDC_ADDRESS, this.adapter.address);
        await depositAndApprove(this.donor, user, WBTC_ADDRESS, this.adapter.address);
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

        // Premium will change after first one bought
        premium = await this.optionViews.getBuyOptionCost(this.market, this.collateralAsset == ONE_ADDRESS ? true : false, this.strikeIndex, this.purchaseAmount);

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
            value: premium,
          }
        );
      });
    });

    describe("#exercise", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("exercises otokens", async function () {
        await depositAndApprove(this.donor, user, USDC_ADDRESS, this.adapter.address);
        await depositAndApprove(this.donor, user, WBTC_ADDRESS, this.adapter.address);
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

        if (this.paymentToken == ETH_ADDRESS) {
          assert.equal(
            (await provider.getBalance(recipient))
              .sub(recipientStartBalance)
              .toString(),
            this.exerciseProfit
          );
        } else {
          const paymentToken = await ethers.getContractAt(
            "IERC20",
            this.paymentToken
          );
          assert.equal(
            (await paymentToken.balanceOf(user)).toString(),
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
