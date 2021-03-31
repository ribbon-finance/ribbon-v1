const { expect, assert } = require("chai");
const { BigNumber, constants } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { provider, getContractAt } = ethers;
const { getDefaultArgs, parseLog, mintAndApprove } = require("./helpers/utils");
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy, wmul } = require("./helpers/utils");

let owner, user;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const UNISWAP_ADDRESS = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
const SUSHISWAP_ADDRESS = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DIGG_ADDRESS = "0x798d1be841a82a273720ce31c822c61a67a601c3";
const SUSHISWAP_LP = "0x9a13867048e01c663ce8ce2fe0cdae69ff9f35e3";
const UNISWAP_LP = "0xe86204c4eddd2f70ee00ead6805f917671f56c52";
const ETH_WBTC_PAIR = "0xbb2b8038a1640196fbe3e38816f3e67cba72d940";
const WBTC_OPTIONS_ADDRESS = "0x3961245db602ed7c03eeccda33ea3846bd8723bd";

const gasPrice = parseUnits("1", "gwei");

describe.skip("StakedPut", () => {
  let initSnapshotId;
  this.gasPrice = ethers.utils.parseUnits("1", "gwei");
  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [
      adminSigner,
      ownerSigner,
      userSigner,
      counterpartySigner,
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;

    const {
      factory,
      hegicAdapter,
      protocolAdapterLib,
      gammaAdapter,
    } = await getDefaultArgs();
    await factory.setAdapter("OPYN_GAMMA", gammaAdapter.address);
    await factory.setAdapter("HEGIC", hegicAdapter.address);
    this.adapter = hegicAdapter;
    this.factory = factory;
    this.protocolAdapterLib = protocolAdapterLib;

    this.hegicOptions = await ethers.getContractAt(
      "IHegicBTCOptions",
      HEGIC_WBTC_OPTIONS
    );

    const uniswapRouterArtifact = await artifacts.readArtifact(
      "IUniswapV2Router02"
    );
    this.uniswap = new ethers.Contract(
      "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
      uniswapRouterArtifact.abi,
      ethers.provider
    );
    this.uniswap = this.uniswap.connect(userSigner);

    this.sushiswap = new ethers.Contract(
      "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",
      uniswapRouterArtifact.abi,
      ethers.provider
    );
    this.sushiswap = this.sushiswap.connect(userSigner);

    const uniswapArtifact = await artifacts.readArtifact("IUniswapV2Pair");
    this.uniswapLp = new ethers.Contract(
      UNISWAP_LP,
      uniswapArtifact.abi,
      ethers.provider
    );
    this.uniswapLp = this.uniswapLp.connect(userSigner);

    this.sushiswapLp = new ethers.Contract(
      SUSHISWAP_LP,
      uniswapArtifact.abi,
      ethers.provider
    );
    this.sushiswapLp = this.sushiswapLp.connect(userSigner);

    const wbtcArtifact = await artifacts.readArtifact("IWETH");
    this.wbtc = new ethers.Contract(
      WBTC_ADDRESS,
      wbtcArtifact.abi,
      ethers.provider
    );
    this.wbtc = this.wbtc.connect(userSigner);
    this.AmmAdapter = await ethers.getContractFactory("AmmAdapter");
    this.ammAdapterLib = await this.AmmAdapter.deploy();
    const UniswapAdapter = await ethers.getContractFactory("UniswapAdapter");

    this.uniswapAdapter = await UniswapAdapter.deploy(
      UNISWAP_ADDRESS,
      SUSHISWAP_ADDRESS,
      WBTC_ADDRESS,
      ETH_ADDRESS,
      UNISWAP_LP,
      SUSHISWAP_LP,
      DIGG_ADDRESS
    );
    //await factory.setAdapter("UNISWAP", this.uniswapAdapter.address);
    this.uniswapAdapterAddress = this.uniswapAdapter.address;

    const initializeTypes = [];
    const initializeArgs = [];
    const deployArgs = [
      factory.address,
      this.uniswapAdapterAddress,
      ETH_WBTC_PAIR,
      ETH_ADDRESS,
      WBTC_ADDRESS,
      WBTC_OPTIONS_ADDRESS,
      USDC_ADDRESS,
    ];
    this.instrument = (
      await deployProxy(
        "StakedPut",
        adminSigner,
        initializeTypes,
        initializeArgs,
        {
          libraries: {
            ProtocolAdapter: protocolAdapterLib.address,
            AmmAdapter: this.ammAdapterLib.address,
          },
        },
        deployArgs
      )
    ).connect(userSigner);

    await this.instrument.connect(userSigner);
    this.optionTerms = [
      WETH_ADDRESS,
      USDC_ADDRESS,
      WETH_ADDRESS,
      "1614326400",
      parseEther("960"),
      2,
      WETH_ADDRESS,
    ];

    this.oTokenAddress = "0x3cF86d40988309AF3b90C14544E1BB0673BFd439";

    this.oToken = await getContractAt("IERC20", this.oTokenAddress);

    this.weth = await getContractAt("IWETH", WETH_ADDRESS);
  });
  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe.skip("constructor", () => {
    time.revertToSnapshotAfterEach();

    it("reverts when deployed with 0x0 factory", async function () {
      const VaultContract = await ethers.getContractFactory("StakedPut", {
        libraries: {
          ProtocolAdapter: this.protocolAdapterLib.address,
          AmmAdapter: this.ammAdapterLib.address,
        },
      });
      await expect(
        VaultContract.deploy(
          constants.AddressZero,
          this.uniswapAdapterAddress,
          ETH_WBTC_PAIR,
          ETH_ADDRESS,
          WBTC_ADDRESS,
          WBTC_OPTIONS_ADDRESS,
          USDC_ADDRESS
        )
      ).to.be.revertedWith("!_factory");
    });
  });
  describe.skip("#initialize", () => {
    it("initializes with correct values", async function () {
      assert.equal(await this.instrument.factory(), this.factory.address);
      //                        assert.equal(await this.vault.owner(), owner);
    });

    it("cannot be initialized twice", async function () {
      await expect(this.instrument.initialize()).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });
  });
  describe.skip("#name", () => {
    it("returns the name", async function () {
      assert.equal(await this.instrument.getName(), "wbtc/digg-staked-put");
    });
  });

  //      behavesLikeStakedPut({
  //                  name: "Hegic ITM Put, UNISWAP LP, WBTC PMT",
  //                  exchangeName: 'UNISWAP',
  //                  lpPurchaseAmount: BigNumber.from("10000"),
  //                  paymentToken: WBTC_ADDRESS,
  //                  amounts: [parseUnits("1", 3), parseUnits("1", 8)],
  //                  strikePrices: [parseEther("45000"), parseEther("34000")],
  //                  purchaseAmount: parseUnits("1", 15),
  //                });

  // behavesLikeStakedPut({
  //                     name: "Hegic ITM Put, SUSHISWAP LP, WBTC PMT",
  //                           exchangeName: 'SUSHISWAP',
  //                           lpPurchaseAmount: BigNumber.from("100000"),
  //                           paymentToken: WBTC_ADDRESS,
  //                           amounts: [parseUnits("1", 3), parseUnits("1", 8)],
  //       strikePrices: [parseEther("45000"), parseEther("34000")],
  //                                   purchaseAmount: parseUnits("1", 15),
  //                         });

  // behavesLikeStakedPut({
  //                           name: "Hegic ITM Put, UNISWAP LP, ETH PMT",
  //                           exchangeName: 'UNISWAP',
  //                           lpPurchaseAmount: BigNumber.from("1000000000000000000"),
  //                           paymentToken: ETH_ADDRESS,
  //                           amounts: [parseUnits("1", 3), parseUnits("1", 8)],
  //                           strikePrices: [parseEther("45000"), parseEther("34000")],
  //                           purchaseAmount: parseUnits("1", 15),
  //                         });

  behavesLikeStakedPut({
    name: "Hegic ITM Put, SUSHISWAP LP, ETH PMT",
    exchangeName: "SUSHISWAP",
    lpPurchaseAmount: BigNumber.from("100000000000000000000"),
    paymentToken: ETH_ADDRESS,
    amounts: [parseUnits("1", 3)],
    strikePrices: [parseEther("45000")],
    purchaseAmount: parseUnits("1", 15),
  });
  behavesLikeStakedPut({
    name: "Hegic ITM Put, SUSHISWAP LP, ETH PMT SMALL AMT",
    exchangeName: "SUSHISWAP",
    lpPurchaseAmount: BigNumber.from("1000000000000000"),
    paymentToken: ETH_ADDRESS,
    amounts: [parseUnits("1", 3)],
    strikePrices: [parseEther("45000")],
    purchaseAmount: parseUnits("1", 15),
  });

  behavesLikeStakedPut({
    name: "Hegic OTM Put, SUSHISWAP LP, ETH PMT SMALL AMT",
    exchangeName: "SUSHISWAP",
    lpPurchaseAmount: BigNumber.from("1000000000000000"),
    paymentToken: ETH_ADDRESS,
    amounts: [parseUnits("1", 3)],
    strikePrices: [parseEther("20000")],
    purchaseAmount: parseUnits("1", 15),
  });

  // behavesLikeStakedPut({
  //                                    name: "Hegic OTM Put, UNISWAP LP, ETH PMT",
  //                                    exchangeName: 'UNISWAP',
  //                                   lpPurchaseAmount: BigNumber.from("10000000000000000000"),
  //                                    paymentToken: ETH_ADDRESS,
  //                                    amounts: [parseUnits("1", 3), parseUnits("1", 8)],
  //                                    strikePrices: [parseEther("25000"), parseEther("34000")],
  //                                    purchaseAmount: parseUnits("1", 15),
  //                                  });
  //behavesLikeStakedPut({
  //                                            name: "Hegic OTM Put, UNISWAP LP, WBTC PMT",
  //                                            exchangeName: 'UNISWAP',
  //                                            lpPurchaseAmount: BigNumber.from("200000"),
  //                                            paymentToken: WBTC_ADDRESS,
  //                                            amounts: [parseUnits("1", 3), parseUnits("1", 8)],
  //                                            strikePrices: [parseEther("25000"), parseEther("34000")],
  //                                            purchaseAmount: parseUnits("1", 15),
  //                                          });
  //     behavesLikeStakedPut({
  //                                                            name: "Hegic OTM Put, SUSHISWAP LP, WBTC PMT",
  //                                                            exchangeName: 'SUSHISWAP',
  //                                                            lpPurchaseAmount: BigNumber.from("20000"),
  //                                                            paymentToken: WBTC_ADDRESS,
  //                                                            amounts: [parseUnits("1", 3), parseUnits("1", 8)],
  //                                                            strikePrices: [parseEther("25000"), parseEther("34000")],
  //                                                            purchaseAmount: parseUnits("1", 15),
  //                                                          });
});
async function checkState(exchangeName, adapterAddress, isAfter) {
  const [, , userSigner, recipientSigner] = await ethers.getSigners();
  user = userSigner.address;
  recipient = recipientSigner.address;
  if (exchangeName == "UNISWAP") {
    lpAddress = UNISWAP_LP;
  }
  if (exchangeName == "SUSHISWAP") {
    lpAddress = SUSHISWAP_LP;
  }
  const wethArtifact = await artifacts.readArtifact("IWETH");
  this.weth = new ethers.Contract(
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    wethArtifact.abi,
    ethers.provider
  );
  this.weth = this.weth.connect(userSigner);
  const tokenArtifact = await artifacts.readArtifact("ERC20");
  this.wbtc = new ethers.Contract(
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    tokenArtifact.abi,
    ethers.provider
  );
  this.wbtc = this.wbtc.connect(userSigner);

  this.digg = new ethers.Contract(
    "0x798d1be841a82a273720ce31c822c61a67a601c3",
    tokenArtifact.abi,
    ethers.provider
  );
  this.digg = this.digg.connect(userSigner);

  const uniswapArtifact = await artifacts.readArtifact("IUniswapV2Pair");
  this.uniswapLp = new ethers.Contract(
    lpAddress,
    uniswapArtifact.abi,
    ethers.provider
  );
  this.uniswapLp = this.uniswapLp.connect(userSigner);
  const ethBalance = await provider.getBalance(user);
  //console.log(`eth balance of user is ${ethBalance}`);
  const ethBalanceAdapter = await provider.getBalance(adapterAddress);
  //        //console.log(`eth balance of adapter is ${ethBalanceAdapter}`);
  const wbtcBalanceAdapter = await this.wbtc.balanceOf(adapterAddress);
  //                //console.log(`wbtc balance of adapter is ${wbtcBalanceAdapter}`);
  const diggBalanceAdapter = await this.digg.balanceOf(adapterAddress);
  //                        //console.log(`digg balance of adapter is ${diggBalanceAdapter}`);
  const lpBalance = await this.uniswapLp.balanceOf(user);
  //                                //console.log(`lp balance of user is ${lpBalance}`);
  const reserveBals = await this.uniswapLp.getReserves();
  //                                        //console.log(reserveBals.reserve0.toString());
  if (isAfter) {
    assert.isTrue(diggBalanceAdapter < 3);
    assert.isTrue(wbtcBalanceAdapter < 3);
    assert.isTrue(lpBalance > 0);
    assert.equal(ethBalanceAdapter, 0);
  }
  return [reserveBals.reserve0, reserveBals.reserve1, wbtcBalanceAdapter];
}

async function checkBalances(beforeBals, afterBals, wbtcAmt) {
  //digg balance should not change
  assert.equal(afterBals[1].toNumber(), beforeBals[1].toNumber());
  //wbtc bal should equal the wbtc input from the user + before pool balance - any leftover wbtc in the contrac
  assert.equal(
    beforeBals[0].toNumber() + wbtcAmt.toNumber() - afterBals[2].toNumber(),
    afterBals[0].toNumber()
  );
}

function behavesLikeStakedPut(params) {
  describe.skip(`${params.name}`, () => {
    time.revertToSnapshotAfterEach();

    it("test oracle", async function () {
      const cur = await this.instrument.getCurrentPrice();
      //              console.log(`price is ${cur.toString()}`);

      const response = await this.instrument.getInputs(
        params.paymentToken,
        params.lpPurchaseAmount,
        params.exchangeName
      );

      //              console.log(response.toString());

      //                      assert.equal(params.lpPurchaseAmount + response.premium.toNumber(), response.totalCost.toNumber());
    });

    it("test buyLp", async function () {
      var tradeAmt;
      var inputVars;
      var valueToSend = params.lpPurchaseAmount;
      const ethBalance = await provider.getBalance(this.instrument.address);
      const lpBalUni = await this.uniswapLp.balanceOf(user);
      //                         console.log(`user lp balance of ${lpBalUni.toString()}`);
      const lpBalSushi = await this.sushiswapLp.balanceOf(user);

      if (params.paymentToken == ETH_ADDRESS) {
        expWbtc = await this.uniswapAdapter
          .connect(userSigner)
          .expectedWbtcOut(params.lpPurchaseAmount, params.exchangeName, {
            from: user,
          });

        inputVars = await this.uniswapAdapter
          .connect(userSigner)
          .expectedDiggOut(expWbtc, params.exchangeName, {
            from: user,
          });
        tradeAmt = inputVars[1];
      }
      //console.log(expWbtc);
      else {
        await this.weth.connect(userSigner).deposit({
          from: user,
          value: BigNumber.from("1000000000000000000"),
        });
        await this.weth
          .connect(userSigner)
          .approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
        await this.uniswap
          .connect(userSigner)
          .swapExactTokensForTokens(
            BigNumber.from("1000000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );
        const approval = await this.wbtc
          .connect(userSigner)
          .approve(
            this.instrument.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );

        inputVars = await this.uniswapAdapter
          .connect(userSigner)
          .expectedDiggOut(params.lpPurchaseAmount, params.exchangeName, {
            from: user,
          });
        tradeAmt = inputVars[1];
        expDigg = inputVars[0];
        expWbtc = 0;
        valueToSend = 0;
      }
      const checkExpDigg = await this.sushiswap
        .connect(userSigner)
        .getAmountsOut(tradeAmt, [WBTC_ADDRESS, DIGG_ADDRESS]);
      //  console.log(`check exp digg is ${checkExpDigg}`);
      //      console.log(`trade amt is ${tradeAmt}`);
      //     console.log(`exp wbtc is ${expWbtc}`);
      //     console.log(`exp digg is ${inputVars[0]}`);
      //     console.log(`lp purchase amt is ${params.lpPurchaseAmount}`);
      //    console.log(params.paymentToken);

      var expDigg = inputVars[0];

      // const approval = await this.wbtc.connect(userSigner).approve(
      //
      //     this.sushiswap.address,
      //
      //     BigNumber.from("1000000000000000000000000000000000"),
      //
      //     { from: user }
      //
      //   );
      //await this.sushiswap.connect(userSigner).swapExactTokensForTokens(tradeAmt, checkExpDigg[0], [WBTC_ADDRESS, DIGG_ADDRESS], user, BigNumber.from("10000000000000000000000000000000"), {from:user});
      const response = await this.instrument.getInputs(
        params.paymentToken,
        params.lpPurchaseAmount,
        params.exchangeName
      );
      //               console.log(response);

      const testRet = await this.instrument
        .connect(userSigner)
        .buyLpFromAdapter(
          params.paymentToken,
          params.lpPurchaseAmount,
          params.exchangeName,
          tradeAmt,
          expWbtc,
          expDigg,
          { value: valueToSend }
        );
      //       console.log(testRet);
      const receipt = await provider.waitForTransaction(testRet.hash);

      const lpBalUni2 = await this.uniswapLp.balanceOf(user);
      //                                                                             console.log(`user uni lp balance of ${lpBalUni2.toString()}`);
      const lpBalSushi2 = await this.sushiswapLp.balanceOf(user);
      //                                                                   console.log(`user sushi lp balance of ${lpBalSushi2.toString()}`);
      const response2 = await this.instrument.getInputs(
        params.paymentToken,
        params.lpPurchaseAmount,
        params.exchangeName
      );
      //               console.log(response2);
    });
    it("test option buy", async function () {
      this.startTime = (await provider.getBlock()).timestamp;
      this.expiry = this.startTime + 60 * 60 * 24 * 2;
      this.buyInstrumentParams = [
        1,
        params.paymentToken,
        params.strikePrices[0],
        params.amounts[0],
        params.purchaseAmount,
        "0x",
      ];
      //const premiumCheck = await this.adapter.premium(this.buyInstrumentParams, this.expiry);
      //               console.log(premiumCheck);

      var valueToSend = params.purchaseAmount;
      if (params.paymentToken == WBTC_ADDRESS) {
        await this.weth.connect(userSigner).deposit({
          from: user,
          value: BigNumber.from("1000000000000000000"),
        });
        await this.weth
          .connect(userSigner)
          .approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
        await this.uniswap
          .connect(userSigner)
          .swapExactTokensForTokens(
            BigNumber.from("1000000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );
        const approval = await this.wbtc
          .connect(userSigner)
          .approve(
            this.instrument.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
        valueToSend = BigNumber.from("0");
      }
      const ethBalance = await provider.getBalance(user);
      //            console.log(`eth balance is ${ethBalance.toString()}`);
      const wbtcBal = await this.wbtc.balanceOf(user);
      //            console.log(`wbtc bal is ${wbtcBal.toString()}`);
      this.startTime = (await provider.getBlock()).timestamp;
      this.expiry = this.startTime + 60 * 60 * 24 * 2;
      this.buyInstrumentParams = [
        params.paymentToken,
        params.strikePrices[0],
        params.amounts[0],
        params.purchaseAmount,
        this.expiry,
        0,
        "",
        0,
        0,
        0,
      ];
      const res = await this.instrument
        .connect(userSigner)
        .buyPutFromAdapter(this.buyInstrumentParams, {
          from: user,
          value: valueToSend,
          //gasPrice: this.gasPrice,
        });
      const receipt = await res.wait();
      //            console.log("gas used", receipt.gasUsed.toString());
      const ethBalance2 = await provider.getBalance(user);
      //            console.log(`eth bal is ${ethBalance2.toString()}`);
      const wbtcBalAfterBuy = await this.wbtc.balanceOf(user);
      //              console.log(`wbtc bal is ${wbtcBalAfterBuy.toString()}`);
      //            console.log("positionId");
      const position = await this.instrument.instrumentPosition(user, 0);
      //              console.log(position);

      const {
        holder,
        strike,
        amount,
        lockedAmount,
        premium,
        expiration,
        optionType,
      } = await this.hegicOptions.options(position.putOptionID);
      assert.equal(holder, this.instrument.address);

      const canExercise = await this.instrument
        .connect(userSigner)
        .canExercise(user, 0, {
          from: user,
        });

      //            console.log(`can this option be exercised: ${canExercise}`);
      const profit = await this.instrument
        .connect(userSigner)
        .exerciseProfit(user, 0, {
          from: user,
          gasPrice,
        });
      //      console.log(`expected profit is ${profit}`);
      const resExercise = await this.instrument
        .connect(userSigner)
        .exercisePosition(0, {
          from: user,
          gasPrice,
        });
      //              console.log(resExercise);

      // const ethBalance3 = await provider.getBalance(user);
      //console.log(`eth bal is ${ethBalance3.toString()}`);
      const wbtcBalAfterExercise = await this.wbtc.balanceOf(user);
      //            console.log(`wbtc bal is ${wbtcBalAfterExercise.toString()}`);
      if (canExercise) {
        assert.equal(
          wbtcBalAfterExercise.toNumber() - wbtcBalAfterBuy.toNumber(),
          profit.toNumber()
        );
      }
    });

    it("reverts instrument buy on invalid exchange", async function () {
      const response = await this.instrument.getInputs(
        params.paymentToken,
        params.lpPurchaseAmount,
        params.exchangeName
      );
      this.buyInstrumentParams = [
        params.paymentToken,
        response.currentPrice,
        response.wbtcSize,
        response.premium + 1,

        response.expiry,
        params.lpPurchaseAmount,
        "UNISWAP",
        response.tradeAmt,
        response.wbtcSize,
        response.expDigg,
      ];

      const res = await expect(
        this.instrument
          .connect(userSigner)
          .buyInstrument(this.buyInstrumentParams, {
            from: user,
            value: BigNumber.from("0"),
            gasPrice: this.gasPrice,
          })
      ).to.be.revertedWith("invalid exchange");
    });

    it("reverts instrument buy on invalid payment token", async function () {
      const response = await this.instrument.getInputs(
        params.paymentToken,
        params.lpPurchaseAmount,
        params.exchangeName
      );
      this.buyInstrumentParams = [
        WBTC_ADDRESS,
        response.currentPrice,
        response.wbtcSize,
        response.premium + 1,

        response.expiry,
        params.lpPurchaseAmount,
        params.exchangeName,
        response.tradeAmt,
        response.wbtcSize,
        response.expDigg,
      ];
      const res = await expect(
        this.instrument
          .connect(userSigner)
          .buyInstrument(this.buyInstrumentParams, {
            from: user,
            value: BigNumber.from("0"),
            gasPrice: this.gasPrice,
          })
      ).to.be.revertedWith("input must be eth");
    });
    it("test instrument buy", async function () {
      const beforeBals = await checkState(
        params.exchangeName,
        this.instrument.address,
        false
      );

      var valueToSend;
      if (params.paymentToken == WBTC_ADDRESS) {
        await this.weth.connect(userSigner).deposit({
          from: user,
          value: BigNumber.from("1000000000000000000"),
        });
        await this.weth
          .connect(userSigner)
          .approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
        await this.uniswap
          .connect(userSigner)
          .swapExactTokensForTokens(
            BigNumber.from("1000000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",

              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );

        valueToSend = BigNumber.from("0");
      }
      const startlpBalUni = await this.uniswapLp.balanceOf(user);

      const startlpBalSushi = await this.sushiswapLp.balanceOf(user);

      const startEthBalance = await provider.getBalance(user);

      const startWbtcBal = await this.wbtc.balanceOf(user);

      const startEthBalanceContract = await provider.getBalance(
        this.instrument.address
      );

      const startWbtcBalContract = await this.wbtc.balanceOf(
        this.instrument.address
      );

      const cur = await this.instrument.getCurrentPrice();
      //console.log(`price is ${cur.toString()}`);

      const response = await this.instrument.getInputs(
        params.paymentToken,
        params.lpPurchaseAmount,
        params.exchangeName
      );
      console.log(`total cost is ${response.totalCost}`);
      if (params.paymentToken == ETH_ADDRESS) {
        valueToSend = response.totalCost;
        //valueToSend = BigNumber.from("10000000000000000000");
      }

      const approval = await this.wbtc.connect(userSigner).approve(
        this.instrument.address,

        response.totalCost,

        { from: user }
      );

      this.buyInstrumentParams = [
        params.paymentToken,
        response.currentPrice,
        response.wbtcSize,
        response.premium + 1,

        response.expiry,
        params.lpPurchaseAmount,
        params.exchangeName,
        response.tradeAmt,
        response.wbtcSize,
        response.expDigg,
      ];
      //             const premiumCheck = await this.adapter.premium(this.buyInstrumentParams, this.expiry);
      const res = await this.instrument
        .connect(userSigner)
        .buyInstrument(this.buyInstrumentParams, {
          from: user,
          value: valueToSend,
          gasPrice: this.gasPrice,
        });

      const receipt = await res.wait();

      const ethBalance2 = await provider.getBalance(user);

      const wbtcBal2 = await this.wbtc.balanceOf(user);
      const ethBalanceContract2 = await provider.getBalance(
        this.instrument.address
      );

      const wbtcBalContract2 = await this.wbtc.balanceOf(
        this.instrument.address
      );

      const lpBalUni2 = await this.uniswapLp.balanceOf(user);

      const lpBalSushi2 = await this.sushiswapLp.balanceOf(user);

      const gasFee = BigNumber.from(gasPrice).mul(
        BigNumber.from(receipt.gasUsed)
      );
      assert.equal(ethBalanceContract2, 0);
      if (params.paymentToken == WBTC_ADDRESS) {
        const expectedAfterWbtcBal =
          startWbtcBal.toNumber() - response.totalCost.toNumber();
        console.log(`gas fee was ${gasFee}`);
        console.log("gas used", receipt.gasUsed.toString());
        console.log(`wbtc bal is ${startWbtcBal.toString()}`);
        console.log(
          `wbtc size of positions is ${response.wbtcSize.toString()}`
        );
        console.log(`total cost ${response.totalCost.toString()}`);
        console.log(`expected wbtc after balance was ${expectedAfterWbtcBal}`);
        console.log(`wbtc user bal after trade is ${wbtcBal2.toString()}`);
      } else {
        const expectedAfterEthBal =
          startEthBalance - response.totalCost - gasFee;
        //                         console.log(`gas fee was ${gasFee}`);
        console.log("gas used", receipt.gasUsed.toString());
        //console.log(`eth balance is ${startEthBalance.toString()}`);
        //console.log(`eth expected after bal is ${expectedAfterEthBal}`);
        //     console.log(`eth user bal after trade is ${ethBalance2.toString()}`);
        console.log(`sent a value of ${valueToSend.toString()}`);
      }
      //               console.log(`wbtc contract bal is ${startWbtcBalContract.toString()}`);
      //                                          console.log(`wbtc contract bal after trade is ${wbtcBalContract2.toString()}`);
      if (params.exchangeName == "UNISWAP") {
        //                     console.log(`user uni lp balance of ${startlpBalUni.toString()}`);
        console.log(
          `user uni lp balance after trade of ${lpBalUni2.toString()}`
        );
      } else {
        //                                                 console.log(`user sushi lp balance of ${startlpBalSushi.toString()}`);
        console.log(
          `user sushi lp balance after trade of ${lpBalSushi2.toString()}`
        );
      }
      const afterBals = await checkState(
        params.exchangeName,
        this.instrument.address,
        true
      );
      checkBalances(beforeBals, afterBals, response.wbtcSize);

      const position = await this.instrument.instrumentPosition(user, 0);
      //                             console.log(position);

      const {
        holder,
        strike,
        amount,
        lockedAmount,
        premium,
        expiration,
        optionType,
      } = await this.hegicOptions.options(position.putOptionID);
      assert.equal(holder, this.instrument.address);
      //check to make sure we are hedged and atm
      assert.equal(response.wbtcSize.toNumber(), amount.toNumber());
      const currentWbtcPrice = await this.instrument.getCurrentPrice();
      //assert.equal(currentWbtcPrice.toNumber(), strike.toNumber());
      console.log(`wbtc size ${currentWbtcPrice}`);
      console.log(`option size is ${strike}`);

      //                     const canExercise = await this.vault
      //                       .connect(ownerSigner)
      //                       .canExercise(owner, 0, {
      //                                         from: owner,
      //                                       });

      //                     console.log(`can this option be exercised: ${canExercise}`);
      //                     const profit = await this.vault
      //                             .connect(ownerSigner)
      //                       .exerciseProfit(owner, 0, {
      //                                         from: owner,
      //                                         gasPrice,
      //                                       });
      //                     console.log(`expected profit is ${profit}`);
      //                     const resExercise = await this.vault
      //                       .connect(ownerSigner)
      //                       .exercisePosition(0, {
      //                                         from: owner,
      //                                         gasPrice,
      //                                       });
      //      console.log(resExercise);
      //
      //                           const ethBalance3 = await provider.getBalance(owner);
      //                                 console.log(`eth bal is ${ethBalance3.toString()}`);
      //                                       const wbtcBal3 = await this.wbtc.balanceOf(owner);
      //                                            console.log(`wbtc bal is ${wbtcBal3.toString()}`);
    });
  });
}
