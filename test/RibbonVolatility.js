const { web3 } = require("@openzeppelin/test-environment");
const { assert, expect } = require("chai");

const { ethers } = require("hardhat");
const { provider, constants, BigNumber } = ethers;
const { parseEther, parseUnits } = ethers.utils;

const time = require("./helpers/time");
const { wmul } = require("./helpers/utils");
const { getDefaultArgs, parseLog, mintAndApprove } = require("./helpers/utils");
const { encodeCall } = require("@openzeppelin/upgrades");
const ZERO_EX_API_RESPONSES = require("./fixtures/GammaAdapter.json");

const rHEGICJSON = require("../constants/abis/rHEGIC2.json");

let owner, user;
let userSigner;
const gasPrice = parseUnits("1", "gwei");

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
const HEGIC_PROTOCOL = "HEGIC";
const GAMMA_PROTOCOL = "OPYN_GAMMA";
const protocolMap = {
  [HEGIC_PROTOCOL]: 1,
  [GAMMA_PROTOCOL]: 2,
};

const ETH_ADDRESS = constants.AddressZero;
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const HEGIC_ETH_REWARDS = "0x957A65705E0aafbb305ab73174203b2E4b77BbFC";
const HEGIC_WBTC_REWARDS = "0xb639BfFa2DA65112654BdAA23B72E0aae604b7bf";

describe("RibbonVolatility", () => {
  /**
   * Current price for ETH-USD = ~$1100
   * Current price for BTC-USD = ~$38000
   */

  behavesLikeRibbonVolatility({
    name: "Gamma OTM Put, Gamma ITM Call",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: ETH_ADDRESS,
    venues: [GAMMA_PROTOCOL, GAMMA_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [parseEther("0.1"), parseEther("0.1")],
    optionsExercised: [false, true],
    strikePrices: [parseEther("800"), parseEther("960")],
    premiums: [BigNumber.from("0"), BigNumber.from("0")],
    purchaseAmount: parseEther("1"),
    expiry: "1614326400",
    optionIDs: ["0", "0"],
    exerciseProfit: BigNumber.from("12727272727272727"),
    actualExerciseProfit: BigNumber.from("12727272727272727"),
    apiResponses: [
      ZERO_EX_API_RESPONSES["0x006583fEea92C695A9dE02C3AC2d4cd321f2F341"],
      ZERO_EX_API_RESPONSES["0x3cF86d40988309AF3b90C14544E1BB0673BFd439"],
    ],
  });

  behavesLikeRibbonVolatility({
    name: "Hegic ITM Put, Hegic OTM Call (ETH)",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    paymentToken: ETH_ADDRESS,
    amounts: [parseEther("1"), parseEther("1")],
    optionsExercised: [true, false],
    strikePrices: [parseEther("1300"), parseEther("1300")],
    premiums: [BigNumber.from("296363339171109209"), BigNumber.from("0")],
    purchaseAmount: parseEther("1"),
    optionIDs: ["2353", "2354"],
    exerciseProfit: BigNumber.from("154765182941453405"),
    actualExerciseProfit: BigNumber.from("154765182941453405"),
  });

  behavesLikeRibbonVolatility({
    name: "Hegic OTM Put, Hegic OTM Call (ETH)",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    paymentToken: ETH_ADDRESS,
    amounts: [parseEther("1"), parseEther("1")],
    optionsExercised: [false, false],
    strikePrices: [parseEther("900"), parseEther("1300")],
    premiums: [BigNumber.from("120217234727039817"), BigNumber.from("0")],
    purchaseAmount: parseEther("1"),
    optionIDs: ["2353", "2354"],
    exerciseProfit: BigNumber.from("0"),
    actualExerciseProfit: BigNumber.from("0"),
  });

  behavesLikeRibbonVolatility({
    name: "Hegic OTM Put, Hegic ITM Call (ETH)",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    paymentToken: ETH_ADDRESS,
    amounts: [parseEther("1"), parseEther("1")],
    optionsExercised: [false, true],
    strikePrices: [parseEther("900"), parseEther("900")],
    premiums: [BigNumber.from("343924487476973783"), BigNumber.from("0")],
    purchaseAmount: parseEther("1"),
    optionIDs: ["2353", "2354"],
    exerciseProfit: BigNumber.from("200547181040532257"),
    actualExerciseProfit: BigNumber.from("200547181040532257"),
  });

  // WBTC VOLATILITY
  behavesLikeRibbonVolatility({
    name: "Hegic ITM Put, Hegic OTM Call (WBTC)",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    paymentToken: WBTC_ADDRESS,
    amounts: [parseUnits("1", 8), parseUnits("1", 8)],
    optionsExercised: [true, false],
    strikePrices: [parseEther("42000"), parseEther("42000")],
    premiums: [BigNumber.from("16459774"), BigNumber.from("4355716")],
    purchaseAmount: parseUnits("1", 8),
    optionIDs: ["1119", "1120"],
    exerciseProfit: BigNumber.from("11302622"),
    actualExerciseProfit: BigNumber.from("11302622"),
  });

  behavesLikeRibbonVolatility({
    name: "Hegic OTM Put, Hegic OTM Call (WBTC)",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    paymentToken: WBTC_ADDRESS,
    amounts: [parseUnits("1", 8), parseUnits("1", 8)],
    optionsExercised: [false, false],
    strikePrices: [parseEther("34000"), parseEther("42000")],
    premiums: [BigNumber.from("4365314"), BigNumber.from("4355716")],
    purchaseAmount: parseUnits("1", 8),
    optionIDs: ["1119", "1120"],
    exerciseProfit: BigNumber.from("0"),
    actualExerciseProfit: BigNumber.from("0"),
  });

  behavesLikeRibbonVolatility({
    name: "Hegic OTM Put, Hegic ITM Call (WBTC)",
    underlying: WBTC_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    paymentToken: WBTC_ADDRESS,
    amounts: [parseUnits("1", 8), parseUnits("1", 8)],
    optionsExercised: [false, true],
    strikePrices: [parseEther("34000"), parseEther("34000")],
    premiums: [BigNumber.from("4365314"), BigNumber.from("15043173")],
    purchaseAmount: parseUnits("1", 8),
    optionIDs: ["1119", "1120"],
    exerciseProfit: BigNumber.from("9897877"),
    actualExerciseProfit: BigNumber.from("9897877"),
  });
});

function behavesLikeRibbonVolatility(params) {
  describe(`${params.name}`, () => {
    let snapshotId, initSnapshotId;

    before(async function () {
      [adminSigner, ownerSigner, userSigner] = await ethers.getSigners();
      admin = adminSigner.address;
      owner = ownerSigner.address;
      user = userSigner.address;

      const venueIDMap = {
        HEGIC: 1,
        OPYN_GAMMA: 2,
      };

      const {
        name,
        symbol,
        underlying,
        strikeAsset,
        venues,
        optionTypes,
        amounts,
        purchaseAmount,
        premiums,
        optionIDs,
        exerciseProfit,
        actualExerciseProfit,
        strikePrices,
        expiry,
        apiResponses,
        collateralAsset,
        optionsExercised,
        paymentToken,
        maxCosts,
      } = params;
      this.name = name;
      this.symbol = symbol;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.collateralAsset = collateralAsset;
      this.strikePrices = strikePrices;
      this.venues = venues;
      this.optionTypes = optionTypes;
      this.amounts = amounts;
      this.amount = amounts[0];
      this.purchaseAmount = purchaseAmount;
      this.optionIDs = optionIDs;
      this.exerciseProfit = exerciseProfit;
      this.actualExerciseProfit = actualExerciseProfit;
      this.optionsExercised = optionsExercised;
      this.paymentToken = paymentToken || ETH_ADDRESS;
      this.maxCosts = maxCosts || [parseEther("9999999"), parseEther("999999")];
      this.apiResponses = apiResponses;

      this.callIndex = optionTypes.indexOf(CALL_OPTION_TYPE);
      this.putIndex = optionTypes.indexOf(PUT_OPTION_TYPE);
      this.callVenue = venueIDMap[venues[this.callIndex]];
      this.putVenue = venueIDMap[venues[this.putIndex]];
      this.callStrikePrice = strikePrices[this.callIndex];
      this.putStrikePrice = strikePrices[this.putIndex];
      this.callMaxCost = this.maxCosts[this.callIndex];
      this.putMaxCost = this.maxCosts[this.putIndex];

      this.premiums = venues.map((venue, i) => {
        return venue === GAMMA_PROTOCOL
          ? calculateZeroExOrderCost(apiResponses[i])
          : premiums[i];
      });

      this.buyData = venues.map((venue, i) =>
        venue === GAMMA_PROTOCOL ? serializeZeroExOrder(apiResponses[i]) : "0x"
      );
      this.callBuyData = this.buyData[this.callIndex];
      this.putBuyData = this.buyData[this.putIndex];

      this.gasPrice = Math.max(
        ...venues.map((venue, i) =>
          venue === GAMMA_PROTOCOL ? apiResponses[i].gasPrice : gasPrice
        )
      );

      this.totalPremium = this.premiums.reduce(
        (a, b) => a.add(b),
        BigNumber.from("0")
      );

      if (this.paymentToken == WBTC_ADDRESS)
        this.totalPremium = BigNumber.from("0");

      this.cost = BigNumber.from("0");
      venues.forEach((venue, index) => {
        if (venue === "OPYN_GAMMA") {
          return;
        }
        this.cost = this.cost.add(premiums[index]);
      });

      this.buyInstrumentParams = [
        this.callVenue,
        this.putVenue,
        this.paymentToken,
        this.callStrikePrice,
        this.putStrikePrice,
        this.amount,
        this.callMaxCost,
        this.putMaxCost,
        this.callBuyData,
        this.putBuyData,
      ];

      this.startTime = (await provider.getBlock()).timestamp;
      this.expiry = expiry || this.startTime + 60 * 60 * 24 * 2; // 2 days from now

      const {
        factory,
        hegicAdapter,
        mockGammaAdapter,
        protocolAdapterLib,
        mockGammaController,
      } = await getDefaultArgs();
      this.factory = factory;
      this.hegicAdapter = hegicAdapter;
      this.gammaAdapter = mockGammaAdapter;
      this.mockGammaController = mockGammaController;

      await factory.setAdapter("OPYN_GAMMA", mockGammaAdapter.address);

      const RibbonVolatility = await ethers.getContractFactory(
        "RibbonVolatility",
        {
          libraries: {
            ProtocolAdapter: protocolAdapterLib.address,
          },
        }
      );
      this.instrumentLogic = await RibbonVolatility.deploy();

      if (this.underlying === ETH_ADDRESS) {
        this.hegicOptions = await ethers.getContractAt(
          "IHegicETHOptions",
          HEGIC_ETH_OPTIONS
        );
      } else if (underlying === WBTC_ADDRESS) {
        this.hegicOptions = await ethers.getContractAt(
          "IHegicBTCOptions",
          HEGIC_WBTC_OPTIONS
        );
      } else {
        throw new Error(`No underlying found ${this.underlying}`);
      }

      const initTypes = [
        "address",
        "address",
        "string",
        "string",
        "address",
        "address",
        "address",
        "uint256",
      ];
      const initArgs = [
        owner,
        this.factory.address,
        this.name,
        "ETH Straddle",
        this.underlying,
        this.strikeAsset,
        this.collateralAsset,
        this.expiry,
      ];
      const initBytes = encodeCall("initialize", initTypes, initArgs);
      const res = await this.factory.newInstrument(
        this.instrumentLogic.address,
        initBytes,
        {
          from: owner,
        }
      );
      const receipt = await provider.waitForTransaction(res.hash);

      const instrumentAddress = (
        await parseLog("RibbonFactory", receipt.logs[2])
      ).args.instrumentAddress;

      this.contract = (
        await ethers.getContractAt("RibbonVolatility", instrumentAddress)
      ).connect(userSigner);

      if (this.paymentToken == WBTC_ADDRESS)
        await mintAndApprove(
          WBTC_ADDRESS,
          userSigner,
          this.contract.address,
          parseUnits("10", 8)
        );

      initSnapshotId = await time.takeSnapshot();
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    describe("#canExercise [ @skip-on-coverage ]", () => {
      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("can exercise when there's exercise profit", async function () {
        await this.contract.buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: this.totalPremium,
          gasPrice: this.gasPrice,
        });

        if (this.venues.includes(GAMMA_PROTOCOL)) {
          await time.increaseTo(this.expiry + 1);
          await this.mockGammaController.setPrice("110000000000");
        }

        const positionID = 0;
        const canExercise = await this.contract.canExercise(user, positionID, {
          from: user,
        });
        if (this.exerciseProfit.isZero()) {
          assert.isFalse(canExercise);
          return;
        }
        assert.isTrue(canExercise);
      });
    });

    describe("#buyInstrument [ @skip-on-coverage ]", () => {
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
          this.contract.buyInstrument(this.buyInstrumentParams, {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          })
        ).to.be.revertedWith("Cannot purchase after expiry");
      });

      it("buys instrument", async function () {
        const res = await this.contract.buyInstrument(
          this.buyInstrumentParams,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        const receipt = await res.wait();
        console.log("gas used", receipt.gasUsed.toString());

        const position = await this.contract.instrumentPosition(user, 0);

        assert.equal(position.exercised, false);
        assert.equal(position.putVenue, protocolMap[this.venues[0]]);
        assert.equal(position.callVenue, protocolMap[this.venues[1]]);
        assert.equal(position.amount, this.amounts[0].toString());
        assert.equal(position.putOptionID, this.optionIDs[0]);
        assert.equal(position.callOptionID, this.optionIDs[1]);

        let i = 0;
        const venues = [
          this.venues[this.putIndex],
          this.venues[this.callIndex],
        ];
        for (const venue of venues) {
          const expectedOptionType = this.optionTypes[i];
          const strikePrice = this.strikePrices[i];
          const hegicScaledStrikePrice = strikePrice.div(
            BigNumber.from("10000000000")
          );
          const purchaseAmount = this.amounts[i];

          if (venue === HEGIC_PROTOCOL) {
            const {
              holder,
              strike,
              amount,
              lockedAmount,
              expiration,
              optionType,
            } = await this.hegicOptions.options(this.optionIDs[i]);

            assert.equal(holder, this.contract.address);
            assert.equal(strike.toString(), hegicScaledStrikePrice);
            assert.equal(lockedAmount.toString(), purchaseAmount);
            assert.equal(amount.toString(), purchaseAmount);
            assert.equal(expiration, this.expiry);
            assert.equal(optionType, expectedOptionType);
          } else if (venue === GAMMA_PROTOCOL) {
            const apiResponse = this.apiResponses[i];

            const buyToken = await ethers.getContractAt(
              "IERC20",
              apiResponse.buyTokenAddress
            );
            const sellToken = await ethers.getContractAt(
              "IERC20",
              apiResponse.sellTokenAddress
            );

            assert.isAtLeast(
              (await buyToken.balanceOf(this.contract.address)).toNumber(),
              parseInt(apiResponse.buyAmount)
            );
            assert.equal(await sellToken.balanceOf(this.contract.address), "0");
          } else {
            throw new Error(`No venue found ${venue}`);
          }
          i++;
        }
      });

      it("does not exceed gas limit budget", async function () {
        const res = await this.contract.buyInstrument(
          this.buyInstrumentParams,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        const receipt = await res.wait();
        console.log(receipt.gasUsed.toString());

        assert.isAtMost(receipt.gasUsed, 1400000);
      });
    });

    describe("#exercisePosition [ @skip-on-coverage ]", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await time.takeSnapshot();
        await this.contract.buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: this.totalPremium,
          gasPrice: this.gasPrice,
        });
        this.positionID = 0;

        if (this.venues.includes(GAMMA_PROTOCOL)) {
          await time.increaseTo(this.expiry + 1);
          const self = this;

          const promises = this.venues.map(async function (venue, venueIndex) {
            if (venue !== GAMMA_PROTOCOL) return;

            const oTokenAddress = self.apiResponses[venueIndex].buyTokenAddress;

            await self.mockGammaController.setPrice("110000000000");

            // load the contract with collateralAsset
            await self.mockGammaController.buyCollateral(oTokenAddress, {
              from: owner,
              value: parseEther("10"),
            });
          });

          await Promise.all(promises);
        }
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("reverts when exercising twice", async function () {
        await this.contract.exercisePosition(this.positionID, { from: user });
        await expect(
          this.contract.exercisePosition(this.positionID, { from: user })
        ).to.be.revertedWith("Already exercised");
      });

      it("exercises one of the options", async function () {
        let startUserBalance, underlying;
        if (this.underlying == constants.AddressZero) {
          startUserBalance = await provider.getBalance(user);
        } else {
          underlying = await ethers.getContractAt("IERC20", this.underlying);
          startUserBalance = await underlying.balanceOf(user);
        }

        const res = await this.contract.exercisePosition(this.positionID, {
          from: user,
          gasPrice,
        });
        const receipt = await provider.waitForTransaction(res.hash);
        const gasUsed = BigNumber.from(gasPrice).mul(
          BigNumber.from(receipt.gasUsed)
        );

        expect(res)
          .to.emit(this.contract, "Exercised")
          .withArgs(
            user,
            this.positionID.toString(),
            this.exerciseProfit,
            this.optionsExercised
          );

        if (this.optionsExercised.includes(true)) {
          assert.isTrue(
            (await this.contract.instrumentPosition(user, this.positionID))
              .exercised
          );
        }

        if (this.underlying == constants.AddressZero) {
          assert.equal(
            (await provider.getBalance(user)).sub(startUserBalance).toString(),
            this.actualExerciseProfit.sub(gasUsed).toString()
          );
        } else {
          assert.equal(
            (await underlying.balanceOf(user)).toString(),
            this.actualExerciseProfit.add(startUserBalance).toString()
          );
        }
      });
    });

    describe("#exerciseProfit [ @skip-on-coverage ]", () => {
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("returns the exercise profit", async function () {
        snapshotId = await time.takeSnapshot();
        await this.contract.buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: this.totalPremium,
          gasPrice: this.gasPrice,
        });
        this.positionID = 0;

        const canExercise = await this.contract.canExercise(
          user,
          this.positionID,
          {
            from: user,
          }
        );
        if (canExercise) {
          assert.equal(
            (
              await this.contract.exerciseProfit(user, this.positionID, {
                from: user,
              })
            ).toString(),
            this.exerciseProfit.toString()
          );
        }
      });
    });

    describe("#numOfPositions", () => {
      beforeEach(async function () {
        await this.contract.buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: this.totalPremium,
        });
      });

      afterEach(async () => {
        await time.revertToSnapShot(initSnapshotId);
      });

      it("gets the number of positions", async function () {
        assert.equal(await this.contract.numOfPositions(user), 1);
      });
    });

    describe("#claimRewards", () => {
      let rhegicContract;
      let withSigner;
      let underlying_address;
      let prov = ethers.getDefaultProvider();
      let res;

      time.revertToSnapshotAfterEach(async function () {
        if (!this.venues.includes(HEGIC_PROTOCOL)) {
          this.skip();
        }

        rhegicContract = new ethers.Contract(
          rHEGICJSON.address,
          rHEGICJSON.abi,
          prov
        );
        withSigner = await rhegicContract.connect(
          await ethers.provider.getSigner(user)
        );
        underlying_address =
          this.underlying == ETH_ADDRESS
            ? HEGIC_ETH_REWARDS
            : HEGIC_WBTC_REWARDS;
        res = await this.contract.buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: this.totalPremium,
          gasPrice: this.gasPrice,
        });
      });

      async function claimRewards(c, optionBuyerAddress) {
        let balanceBefore = await withSigner.balanceOf(optionBuyerAddress);
        const res = await c.claimRewards(underlying_address);
        let balanceAfter = await withSigner.balanceOf(optionBuyerAddress);
        return balanceAfter - balanceBefore;
      }

      it("claimRewards() sends rewards to buyer", async function () {
        const claimedRewards = await claimRewards(this.contract, user);
        assert.isAtLeast(claimedRewards, 1000000000000000000);
      });

      it("claimRewards() sends same amount as rewardsClaimable() returns", async function () {
        const rewardsClaimable = (
          await this.contract.rewardsClaimable(underlying_address)
        ).toString();
        const claimedRewards = await claimRewards(this.contract, user);
        assert.equal(claimedRewards, parseInt(rewardsClaimable));
      });

      it("rewardsClaimable() shows less when optionIDs claimed", async function () {
        const rewardsClaimable = (
          await this.contract.rewardsClaimable(underlying_address)
        ).toString();
        const claimedRewards = await claimRewards(this.contract, user);
        const rewardsClaimable2 = (
          await this.contract.rewardsClaimable(underlying_address)
        ).toString();
        assert.isAbove(claimedRewards, parseInt(rewardsClaimable2));
      });

      it("claimRewards() claims less when first optionIDs claimed", async function () {
        const claimedRewards = await claimRewards(this.contract, user);

        const _ = await this.contract.buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: this.totalPremium,
          gasPrice: this.gasPrice,
        });

        const claimedRewards2 = await claimRewards(this.contract, user);

        assert.equal(claimedRewards, claimedRewards2);
      });

      it("claimRewards() reverts as there are no rewards to claim", async function () {
        const claimedRewards = await claimRewards(this.contract, user);
        await expect(
          this.contract.claimRewards(underlying_address)
        ).to.be.revertedWith("No rewards to claim");
      });
    });

    describe("#initialize", () => {
      it("should have the correct owner", async function () {
        assert.equal(await this.contract.owner(), owner);
      });

      it("cannot initialize twice", async function () {
        await expect(
          this.contract.initialize(
            owner,
            this.factory.address,
            "test",
            "test",
            WETH_ADDRESS,
            USDC_ADDRESS,
            WETH_ADDRESS,
            this.expiry
          )
        ).to.be.revertedWith("Contract instance has already been initialized");
      });
    });
  });
}

function serializeZeroExOrder(apiResponse) {
  return web3.eth.abi.encodeParameters(
    [
      {
        ZeroExOrder: {
          exchangeAddress: "address",
          buyTokenAddress: "address",
          sellTokenAddress: "address",
          allowanceTarget: "address",
          protocolFee: "uint256",
          makerAssetAmount: "uint256",
          takerAssetAmount: "uint256",
          swapData: "bytes",
        },
      },
    ],
    [
      {
        exchangeAddress: apiResponse.to,
        buyTokenAddress: apiResponse.buyTokenAddress,
        sellTokenAddress: apiResponse.sellTokenAddress,
        allowanceTarget: apiResponse.to,
        protocolFee: apiResponse.protocolFee,
        makerAssetAmount: apiResponse.buyAmount,
        takerAssetAmount: apiResponse.sellAmount,
        swapData: apiResponse.data,
      },
    ]
  );
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
