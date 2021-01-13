const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const {
  ether,
  BN,
  time,
  constants,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  balance,
} = require("@openzeppelin/test-helpers");
const helper = require("./helper.js");
const { getDefaultArgs } = require("./utils");
const { encodeCall } = require("@openzeppelin/upgrades");
const DojimaVolatility = contract.fromArtifact("DojiVolatility");
const IERC20 = contract.fromArtifact("IERC20");
const IHegicETHOptions = contract.fromArtifact("IHegicETHOptions");
const IHegicBTCOptions = contract.fromArtifact("IHegicBTCOptions");
const { wmul } = require("../scripts/helpers/utils");
const ZERO_EX_API_RESPONSES = require("./fixtures/GammaAdapter.json");

const [admin, owner, user] = accounts;
const gasPrice = web3.utils.toWei("10", "gwei");

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;
const HEGIC_PROTOCOL = "HEGIC";
const GAMMA_PROTOCOL = "OPYN_GAMMA";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_ETH_OPTIONS = "0xEfC0eEAdC1132A12c9487d800112693bf49EcfA2";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";

describe("DojiVolatility", () => {
  /**
   * Current price for ETH-USD = ~$1100
   * Current price for BTC-USD = ~$38000
   */

  // Hegic ITM Put, Hegic OTM Call
  behavesLikeDojiVolatility({
    name: "Hegic ITM Put, Hegic OTM Call",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [ether("1"), ether("1")],
    strikePrices: [ether("1300"), ether("1300")],
    premiums: [new BN("296363339171109209"), new BN("0")],
    purchaseAmount: ether("1"),
    optionIDs: ["2353", "2354"],
    exerciseProfit: new BN("154765182941453405"),
    actualExerciseProfit: new BN("154765182941453405"),
  });

  // Hegic OTM Put, Hegic ITM Call
  behavesLikeDojiVolatility({
    name: "Hegic OTM Put, Hegic ITM Call",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    venues: [HEGIC_PROTOCOL, HEGIC_PROTOCOL],
    optionTypes: [PUT_OPTION_TYPE, CALL_OPTION_TYPE],
    amounts: [ether("1"), ether("1")],
    strikePrices: [ether("900"), ether("900")],
    premiums: [new BN("343924487476973783"), new BN("0")],
    purchaseAmount: ether("1"),
    optionIDs: ["2353", "2354"],
    exerciseProfit: new BN("200547181040532257"),
    actualExerciseProfit: new BN("200547181040532257"),
  });

  // behavesLikeDojiVolatility({
  //   name: "Hegic OTM Put, Gamma ITM Call",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   collateralAsset: ETH_ADDRESS,
  //   venues: [GAMMA_PROTOCOL],
  //   optionTypes: [CALL_OPTION_TYPE],
  //   amounts: [ether("0.1")],
  //   strikePrices: [ether("960")],
  //   premiums: [new BN("0")],
  //   purchaseAmount: ether("1"),
  //   expiry: "1614326400",
  //   optionIDs: ["0"],
  //   exerciseProfit: new BN("12727272727272727"),
  //   actualExerciseProfit: new BN("12727272727272727"),
  //   apiResponses: [
  //     ZERO_EX_API_RESPONSES["0x3cF86d40988309AF3b90C14544E1BB0673BFd439"],
  //   ],
  // });
});

function behavesLikeDojiVolatility(params) {
  describe(`${params.name}`, () => {
    let snapshotId, initSnapshotId;

    before(async function () {
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

      this.totalPremium = this.premiums.reduce((a, b) => a.add(b), new BN("0"));

      this.cost = new BN("0");
      venues.forEach((venue, index) => {
        if (venue === "OPYN_GAMMA") {
          return;
        }
        this.cost = this.cost.add(premiums[index]);
      });

      this.startTime = (await web3.eth.getBlock("latest")).timestamp;
      this.expiry = expiry || this.startTime + 60 * 60 * 24 * 2; // 2 days from now

      const {
        factory,
        hegicAdapter,
        gammaAdapter,
        protocolAdapterLib,
        mockGammaController,
      } = await getDefaultArgs(admin, owner, user);
      this.factory = factory;
      this.hegicAdapter = hegicAdapter;
      this.gammaAdapter = gammaAdapter;
      this.mockGammaController = mockGammaController;

      await DojimaVolatility.detectNetwork();
      await DojimaVolatility.link(
        "ProtocolAdapter",
        protocolAdapterLib.address
      );
      this.instrumentLogic = await DojimaVolatility.new({ from: admin });

      if (this.underlying === ETH_ADDRESS) {
        this.hegicOptions = await IHegicETHOptions.at(HEGIC_ETH_OPTIONS);
      } else if (underlying === WBTC_ADDRESS) {
        this.hegicOptions = await IHegicBTCOptions.at(HEGIC_WBTC_OPTIONS);
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

      this.contract = await DojimaVolatility.at(
        res.logs[1].args.instrumentAddress
      );

      const snapShot = await helper.takeSnapshot();
      initSnapshotId = snapShot["result"];
    });

    after(async () => {
      await helper.revertToSnapShot(initSnapshotId);
    });

    describe("#cost", () => {
      beforeEach(async () => {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
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

    describe("#buyInstrument", () => {
      let snapshotId;

      beforeEach(async () => {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
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
      //         value: this.premiums[0].mul(new BN("3")), // just multiply premium by 3 because doubling the premiums sometimes doesnt work
      //         gasPrice: this.gasPrice,
      //       }
      //     ),
      //     "Must have both put and call options"
      //   );
      // });

      it("reverts when buying after expiry", async function () {
        await time.increaseTo(this.expiry + 1);

        await expectRevert(
          this.contract.buyInstrument(
            this.venues,
            this.optionTypes,
            this.amounts,
            this.strikePrices,
            this.buyData,
            {
              from: user,
              value: this.totalPremium,
              gasPrice: this.gasPrice,
            }
          ),
          "Cannot purchase after expiry"
        );
      });

      it("buys instrument", async function () {
        const res = await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );

        expectEvent(res, "PositionCreated", {
          account: user,
          positionID: "0",
          venues: this.venues,
        });

        const { optionTypes, amounts } = res.logs[0].args;
        assert.deepEqual(
          optionTypes.map((o) => o.toNumber()),
          this.optionTypes
        );
        assert.deepEqual(
          amounts.map((a) => a.toString()),
          this.amounts.map((a) => a.toString())
        );

        const position = await this.contract.instrumentPosition(user, 0);

        assert.equal(position.exercised, false);
        assert.deepEqual(position.venues, this.venues);
        assert.deepEqual(
          position.optionTypes.map((o) => o.toString()),
          this.optionTypes.map((o) => o.toString())
        );
        assert.deepEqual(
          position.amounts.map((a) => a.toString()),
          this.amounts.map((a) => a.toString())
        );
        assert.deepEqual(position.optionIDs, this.optionIDs);

        let i = 0;
        for (const venue of this.venues) {
          const expectedOptionType = this.optionTypes[i];
          const strikePrice = this.strikePrices[i];
          const hegicScaledStrikePrice = strikePrice.div(new BN("10000000000"));
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

            const buyToken = await IERC20.at(apiResponse.buyTokenAddress);
            const sellToken = await IERC20.at(apiResponse.sellTokenAddress);

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
          this.amounts,
          this.strikePrices,
          this.buyData,
          {
            from: user,
            value: this.totalPremium,
            gasPrice: this.gasPrice,
          }
        );

        assert.isAtMost(res.receipt.gasUsed, 900000);
      });
    });

    describe("#exercisePosition", () => {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = (await helper.takeSnapshot())["result"];
        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
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
            value: ether("10"),
          });
        }
      });

      afterEach(async () => {
        await helper.revertToSnapShot(snapshotId);
      });

      it("reverts when exercising twice", async function () {
        await this.contract.exercisePosition(this.positionID, { from: user });
        await expectRevert(
          this.contract.exercisePosition(this.positionID, { from: user }),
          "Already exercised"
        );
      });

      it("exercises one of the options", async function () {
        const userTracker = await balance.tracker(user, "wei");

        const res = await this.contract.exercisePosition(this.positionID, {
          from: user,
          gasPrice,
        });
        const gasUsed = new BN(gasPrice).mul(new BN(res.receipt.gasUsed));

        expectEvent(res, "Exercised", {
          account: user,
          positionID: this.positionID.toString(),
          totalProfit: this.exerciseProfit,
        });

        if (this.underlying == constants.ZERO_ADDRESS) {
          assert.equal(
            (await userTracker.delta()).toString(),
            this.actualExerciseProfit.sub(gasUsed).toString()
          );
        } else {
          const underlying = await IERC20.at(this.underlying);
          assert.equal(
            (await underlying.balanceOf(user)).toString(),
            this.actualExerciseProfit
          );
        }
      });
    });

    describe("#numOfPositions", () => {
      let snapshotId;

      beforeEach(async function () {
        const snapShot = await helper.takeSnapshot();
        snapshotId = snapShot["result"];

        await this.contract.buyInstrument(
          this.venues,
          this.optionTypes,
          this.amounts,
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
        await helper.revertToSnapShot(initSnapshotId);
      });

      it("gets the number of positions", async function () {
        assert.equal(await this.contract.numOfPositions(user), 1);
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
    return new BN(apiResponse.sellAmount);
  } else {
    decimals = 10 ** 18;
  }

  const scaledSellAmount = parseInt(apiResponse.sellAmount) / decimals;
  const totalETH =
    scaledSellAmount / parseFloat(apiResponse.sellTokenToEthRate);

  return ether(totalETH.toPrecision(6)).add(new BN(apiResponse.value));
}
