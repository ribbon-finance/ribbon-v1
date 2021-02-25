const { web3 } = require("@openzeppelin/test-environment");
const { assert, expect } = require("chai");

const { ethers } = require("hardhat");
const { provider, constants, BigNumber } = ethers;
const { parseEther, parseUnits } = ethers.utils;

const time = require("./helpers/time");
const { getDefaultArgs, parseLog } = require("./helpers/utils");
const { encodeCall } = require("@openzeppelin/upgrades");
const ZERO_EX_API_RESPONSES = require("./fixtures/GammaAdapter.json");

const rHEGICJSON = require("../constants/abis/rHEGIC2.json");

let owner, user;
const gasPrice = parseUnits("10", "gwei");

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
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const HEGIC_ETH_REWARDS = "0x957A65705E0aafbb305ab73174203b2E4b77BbFC";
//const HEGIC_WBTC_REWARDS = "0xb639BfFa2DA65112654BdAA23B72E0aae604b7bf";

describe("RibbonVolatility", () => {
  /**
   * Current price for ETH-USD = ~$1100
   * Current price for BTC-USD = ~$38000
   */

  behavesLikeRibbonVolatility({
    name: "Hegic ITM Put, Hegic OTM Call",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
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
    name: "Hegic OTM Put, Hegic OTM Call",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
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
    name: "Hegic OTM Put, Hegic ITM Call",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [parseEther("1"), parseEther("1")],
    optionsExercised: [false, true],
    strikePrices: [parseEther("900"), parseEther("900")],
    premiums: [BigNumber.from("343924487476973783"), BigNumber.from("0")],
    purchaseAmount: parseEther("1"),
    optionIDs: ["2353", "2354"],
    exerciseProfit: BigNumber.from("200547181040532257"),
    actualExerciseProfit: BigNumber.from("200547181040532257"),
  });

  // behavesLikeRibbonVolatility({
  //   name: "Hegic OTM Put, Gamma ITM Call",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   collateralAsset: ETH_ADDRESS,
  //   venues: [GAMMA_PROTOCOL],
  //   optionTypes: [CALL_OPTION_TYPE],
  //   amounts: [parseEther("0.1")],
  //   strikePrices: [parseEther("960")],
  //   premiums: [BigNumber.from("0")],
  //   purchaseAmount: parseEther("1"),
  //   expiry: "1614326400",
  //   optionIDs: ["0"],
  //   exerciseProfit: BigNumber.from("12727272727272727"),
  //   actualExerciseProfit: BigNumber.from("12727272727272727"),
  //   apiResponses: [
  //     ZERO_EX_API_RESPONSES["0x3cF86d40988309AF3b90C14544E1BB0673BFd439"],
  //   ],
  // });
});

function behavesLikeRibbonVolatility(params) {
  describe(`${params.name}`, () => {
    let snapshotId, initSnapshotId;

    before(async function () {
      const [adminSigner, ownerSigner, userSigner] = await ethers.getSigners();
      admin = adminSigner.address;
      owner = ownerSigner.address;
      user = userSigner.address;

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
      this.purchaseAmount = purchaseAmount;
      this.optionIDs = optionIDs;
      this.exerciseProfit = exerciseProfit;
      this.actualExerciseProfit = actualExerciseProfit;
      this.optionsExercised = optionsExercised;

      this.apiResponses = apiResponses;

      this.premiums = venues.map((venue, i) => {
        return venue === GAMMA_PROTOCOL
          ? calculateZeroExOrderCost(apiResponses[i])
          : premiums[i];
      });

      this.buyData = venues.map((venue, i) =>
        venue === GAMMA_PROTOCOL ? serializeZeroExOrder(apiResponses[i]) : "0x"
      );

      this.gasPrice = Math.max(
        ...venues.map((venue, i) =>
          venue === GAMMA_PROTOCOL ? apiResponses[i].gasPrice : gasPrice
        )
      );

      this.totalPremium = this.premiums.reduce(
        (a, b) => a.add(b),
        BigNumber.from("0")
      );

      this.cost = BigNumber.from("0");
      venues.forEach((venue, index) => {
        if (venue === "OPYN_GAMMA") {
          return;
        }
        this.cost = this.cost.add(premiums[index]);
      });

      this.startTime = (await provider.getBlock()).timestamp;
      this.expiry = expiry || this.startTime + 60 * 60 * 24 * 2; // 2 days from now

      const {
        factory,
        hegicAdapter,
        gammaAdapter,
        protocolAdapterLib,
        mockGammaController,
      } = await getDefaultArgs();
      this.factory = factory;
      this.hegicAdapter = hegicAdapter;
      this.gammaAdapter = gammaAdapter;
      this.mockGammaController = mockGammaController;

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

      this.contractv2 = (
        await ethers.getContractAt("RibbonVolatility", instrumentAddress)
      )

      initSnapshotId = await time.takeSnapshot();
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    describe("#cost", () => {
      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("returns the total cost of the position", async function () {
        assert.equal(
          (
            await this.contract.cost(
              this.venues,
              this.optionTypes,
              this.amounts,
              this.strikePrices
            )
          ).toString(),
          this.cost
        );
      });
    });

    describe("#canExercise", () => {
      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      it("can exercise when there's exercise profit", async function () {
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        const positionID = 0;

        const venueIndex = this.venues.findIndex((v) => v === GAMMA_PROTOCOL);
        if (venueIndex !== -1) {
          await time.increaseTo(this.expiry + 1);
          await this.mockGammaController.setPrice("110000000000");
        }

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

    describe("#buyInstrument", () => {
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await time.takeSnapshot();
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      // it("reverts when passed less than 2 venues", async function () {
      //   await expectRevert(
      //     this.contract.buyInstrument(
      //       [this.venues[0]],
      //       [this.optionTypes[0]],
      //       [this.amounts[0]],
      //       [this.strikePrices[0]],
      //       this.buyData,
      //       {
      //         from: user,
      //         value: this.premiums[0],
      //         gasPrice: this.gasPrice,
      //       }
      //     ),
      //     "Must have at least 2 venues"
      //   );
      // });

      // it("reverts when passed 2 options of the same type", async function () {
      //   await expectRevert(
      //     this.contract.buyInstrument(
      //       [this.venues[0], this.venues[0]],
      //       [this.optionTypes[0], this.optionTypes[0]],
      //       [this.amounts[0], this.amounts[0]],
      //       [this.strikePrices[0], this.strikePrices[0]],
      //       this.buyData,
      //       {
      //         from: user,
      //         value: this.premiums[0].mul(BigNumber.from("3")), // just multiply premium by 3 because doubling the premiums sometimes doesnt work
      //         gasPrice: this.gasPrice,
      //       }
      //     ),
      //     "Must have both put and call options"
      //   );
      // });

      it("reverts when buying after expiry", async function () {
        await time.increaseTo(this.expiry + 1);

        await expect(
          this.contract.buyInstrument(
            this.venues,
            this.optionTypes,
            this.amounts[0],
            this.strikePrices,
            this.buyData,
            {
              from: user,
              value: this.totalPremium,
              gasPrice: this.gasPrice,
            }
          )
        ).to.be.revertedWith("Cannot purchase after expiry");
      });

      it("buys instrument", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        const receipt = await res.wait();
        console.log("gas used", receipt.gasUsed.toString());

        expect(res)
          .to.emit(this.contract, "PositionCreated")
          .withArgs(user, "0", this.venues, this.optionTypes, this.amounts[0]);

        const { optionTypes, amount } = (
          await parseLog(
            "RibbonVolatility",
            receipt.logs[receipt.logs.length - 1]
          )
        ).args;

        assert.deepEqual(optionTypes, this.optionTypes);
        assert.equal(amount, this.amounts[0].toString());

        const position = await this.contract.instrumentPosition(user, 0);

        assert.equal(position.exercised, false);
        assert.equal(position.putVenue, protocolMap[this.venues[0]]);
        assert.equal(position.callVenue, protocolMap[this.venues[1]]);
        assert.equal(position.amount, this.amounts[0].toString());
        assert.equal(position.callOptionID, this.optionIDs[0]);
        assert.equal(position.putOptionID, this.optionIDs[1]);

        let i = 0;
        for (const venue of this.venues) {
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
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        const receipt = await provider.waitForTransaction(res.hash);

        assert.isAtMost(receipt.gasUsed, 1200000);
      });
    });

    describe("#exercisePosition", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await time.takeSnapshot();
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        this.positionID = 0;

        const venueIndex = this.venues.findIndex((v) => v === GAMMA_PROTOCOL);

        if (venueIndex !== -1) {
          await time.increaseTo(this.expiry + 1);

          const oTokenAddress = this.apiResponses[venueIndex].buyTokenAddress;

          await this.mockGammaController.setPrice("110000000000");

          // load the contract with collateralAsset
          await this.mockGammaController.buyCollateral(oTokenAddress, {
            from: owner,
            value: parseEther("10"),
          });
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
        const startUserBalance = await provider.getBalance(user);

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

        if (this.underlying == constants.AddressZero) {
          assert.equal(
            (await provider.getBalance(user)).sub(startUserBalance).toString(),
            this.actualExerciseProfit.sub(gasUsed).toString()
          );
        } else {
          const underlying = await ethers.getContractAt(
            "IERC20",
            this.underlying
          );
          assert.equal(
            (await underlying.balanceOf(user)).toString(),
            this.actualExerciseProfit
          );
        }
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

      it("returns the exercise profit", async function () {
        snapshotId = await time.takeSnapshot();
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
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
            this.exerciseProfit
          );
        }
      });
    });

    describe("#numOfPositions", () => {
      beforeEach(async function () {
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
      });

      afterEach(async () => {
        await time.revertToSnapShot(initSnapshotId);
      });

      it("gets the number of positions", async function () {
        assert.equal(await this.contract.numOfPositions(user), 1);
      });
    });

     //REMOVE .skip to run
     // Block Nbr used: 11896180

    describe("#claimRewards", () => {
      let snapshotId;
      let rhegicContract;
      let withSigner;
      let prov = ethers.getDefaultProvider();

      beforeEach(async function () {
        snapshotId = await time.takeSnapshot();
        rhegicContract = new ethers.Contract(rHEGICJSON.address, rHEGICJSON.abi, prov);
        withSigner = await rhegicContract.connect(await ethers.provider.getSigner(user));
      });

      afterEach(async () => {
        await time.revertToSnapShot(snapshotId);
      });

      async function claimRewards(c, optionBuyerAddress) {
        let balanceBefore = await withSigner.balanceOf(optionBuyerAddress);
        const res = await c.claimRewards(HEGIC_PROTOCOL, HEGIC_ETH_REWARDS);
        let balanceAfter = await withSigner.balanceOf(optionBuyerAddress);
        return balanceAfter - balanceBefore;
      }

      it("claimRewards() sends rewards to buyer", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );
        const claimedRewards = await claimRewards(this.contract, user);
        assert.isAtLeast(claimedRewards, 1000000000000000000);
      });

      it("claimRewards() sends same amount as rewardsClaimable() returns", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );

        const rewardsClaimable = (await this.contract.rewardsClaimable(HEGIC_PROTOCOL, HEGIC_ETH_REWARDS)).toString();
        const claimedRewards = await claimRewards(this.contract, user);
        assert.equal(claimedRewards, parseInt(rewardsClaimable));
      });

      it("rewardsClaimable() shows less when optionIDs claimed", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts[0],
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );

        const rewardsClaimable = (await this.contract.rewardsClaimable(HEGIC_PROTOCOL, HEGIC_ETH_REWARDS)).toString();
        const claimedRewards = await claimRewards(this.contract, user);
        const rewardsClaimable2 = (await this.contract.rewardsClaimable(HEGIC_PROTOCOL, HEGIC_ETH_REWARDS)).toString();
        assert.isAbove(claimedRewards, parseInt(rewardsClaimable2));
      });

      it("claimRewards() reverts as there are no rewards to claim", async function () {
        await expect(this.contract.claimRewards(HEGIC_PROTOCOL, HEGIC_ETH_REWARDS)).to.be.revertedWith("No rewards to claim");
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
