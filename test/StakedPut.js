const { expect, assert } = require("chai");
const { BigNumber, constants } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");
const { ethers, artifacts } = require("hardhat");
const { provider, getContractAt } = ethers;
const { getDefaultArgs } = require("./helpers/utils");
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy } = require("./helpers/utils");

let user;
let adminSigner, userSigner;

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HEGIC_PRICE_FEED = "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c";
const HEGIC_WBTC_OPTIONS = "0x3961245DB602eD7c03eECcda33eA3846bD8723BD";
const SUSHISWAP_ADDRESS = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DIGG_ADDRESS = "0x798d1be841a82a273720ce31c822c61a67a601c3";
const SUSHISWAP_LP = "0x9a13867048e01c663ce8ce2fe0cdae69ff9f35e3";
const UNISWAP_LP = "0xe86204c4eddd2f70ee00ead6805f917671f56c52";
const WBTC_OPTIONS_ADDRESS = "0x3961245db602ed7c03eeccda33ea3846bd8723bd";

const gasPrice = parseUnits("1", "gwei");

describe("StakedPut", () => {
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
  });

  let initSnapshotId;
  this.gasPrice = ethers.utils.parseUnits("1", "gwei");
  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [adminSigner, , userSigner] = await ethers.getSigners();
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
      SUSHISWAP_ADDRESS,
      WBTC_ADDRESS,
      WETH_ADDRESS,
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
      WBTC_ADDRESS,
      WBTC_OPTIONS_ADDRESS,
      USDC_ADDRESS,
      HEGIC_PRICE_FEED,
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

  describe("constructor", () => {
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
          WBTC_ADDRESS,
          WBTC_OPTIONS_ADDRESS,
          USDC_ADDRESS,
          HEGIC_PRICE_FEED
        )
      ).to.be.revertedWith("!_factory");
    });
  });
  describe("#initialize", () => {
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
  describe("#name", () => {
    it("returns the name", async function () {
      assert.equal(await this.instrument.getName(), "wbtc/digg-staked-put");
    });
  });

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
});
async function checkState(exchangeName, adapterAddress, isAfter) {
  const [, , userSigner] = await ethers.getSigners();
  user = userSigner.address;
  let lpAddress;
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
  await provider.getBalance(user);
  const ethBalanceAdapter = await provider.getBalance(adapterAddress);
  const wbtcBalanceAdapter = await this.wbtc.balanceOf(adapterAddress);
  await this.digg.balanceOf(adapterAddress);
  const lpBalance = await this.uniswapLp.balanceOf(user);
  const reserveBals = await this.uniswapLp.getReserves();
  if (isAfter) {
    //                                                        assert.isTrue(diggBalanceAdapter < 3);
    //                                                              assert.isTrue(wbtcBalanceAdapter < 3);
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
  describe(`${params.name}`, () => {
    time.revertToSnapshotAfterEach();

    it("test oracle", async function () {
      await this.instrument.getCurrentPrice();
      await this.instrument.getInputs(params.lpPurchaseAmount);
    });

    it("test option buy", async function () {
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
        await this.wbtc
          .connect(userSigner)
          .approve(
            this.instrument.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
        valueToSend = BigNumber.from("0");
      }
      await provider.getBalance(user);
      await this.wbtc.balanceOf(user);
      this.startTime = (await provider.getBlock()).timestamp;
      this.expiry = this.startTime + 60 * 60 * 24 * 2;

      const response = await this.instrument.getInputs(params.lpPurchaseAmount);

      this.buyInstrumentParams = [
        params.strikePrices[0],
        params.amounts[0],
        params.purchaseAmount,
        response.expiry,
        0,
        0,
        0,
        0,
      ];
      await this.instrument
        .connect(userSigner)
        .buyPutFromAdapter(this.buyInstrumentParams, {
          from: user,
          value: valueToSend,
        });
      const wbtcBalAfterBuy = await this.wbtc.balanceOf(user);
      const position = await this.instrument.instrumentPosition(user, 0);

      const { holder } = await this.hegicOptions.options(position.putOptionID);
      assert.equal(holder, this.instrument.address);

      await time.increaseTo(response.expiry - 1);

      const canExercise = await this.instrument
        .connect(userSigner)
        .canExercise(user, 0, {
          from: user,
        });

      const profit = await this.instrument
        .connect(userSigner)
        .exerciseProfit(user, 0, {
          from: user,
          gasPrice,
        });

      await this.instrument.connect(userSigner).exercisePosition(0, {
        from: user,
        gasPrice,
      });

      const wbtcBalAfterExercise = await this.wbtc.balanceOf(user);
      if (canExercise) {
        assert.equal(
          wbtcBalAfterExercise.toNumber() - wbtcBalAfterBuy.toNumber(),
          profit.toNumber()
        );
      }
    });

    it("reverts instrument buy on invalid payment token", async function () {
      const response = await this.instrument.getInputs(params.lpPurchaseAmount);
      this.buyInstrumentParams = [
        response.currentPrice,
        response.wbtcSize,
        response.premium + 1,
        response.expiry,
        params.lpPurchaseAmount,
        response.tradeAmt,
        response.wbtcSize,
        response.expDigg,
      ];
      await expect(
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

      const response = await this.instrument.getInputs(params.lpPurchaseAmount);
      // console.log(`total cost is ${response.totalCost}`);
      if (params.paymentToken == ETH_ADDRESS) {
        valueToSend = response.totalCost;
        //valueToSend = BigNumber.from("10000000000000000000");
      }

      await this.wbtc.connect(userSigner).approve(
        this.instrument.address,

        response.totalCost,

        { from: user }
      );

      this.buyInstrumentParams = [
        response.currentPrice,
        response.wbtcSize,
        response.premium + 1,
        response.expiry,
        params.lpPurchaseAmount,
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

      assert.isAtMost(receipt.gasUsed.toNumber(), 1000000);

      const wbtcBal2 = await this.wbtc.balanceOf(user);
      const ethBalanceContract2 = await provider.getBalance(
        this.instrument.address
      );

      const lpBalUni2 = await this.uniswapLp.balanceOf(user);

      const lpBalSushi2 = await this.sushiswapLp.balanceOf(user);

      const gasFee = BigNumber.from(gasPrice).mul(
        BigNumber.from(receipt.gasUsed)
      );
      assert.equal(ethBalanceContract2, 0);
      if (params.paymentToken == WBTC_ADDRESS) {
        const startWbtcBal = await this.wbtc.balanceOf(user);

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
        console.log("gas used", receipt.gasUsed.toString());
        console.log(`sent a value of ${valueToSend.toString()}`);
      }
      if (params.exchangeName == "UNISWAP") {
        //console.log(`user uni lp balance of ${startlpBalUni.toString()}`);
        console.log(
          `user uni lp balance after trade of ${lpBalUni2.toString()}`
        );
      } else {
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
      //console.log(position);

      const { holder, strike, amount } = await this.hegicOptions.options(
        position.putOptionID
      );
      assert.equal(holder, this.instrument.address);
      //check to make sure we are hedged and atm
      assert.equal(response.wbtcSize.toNumber(), amount.toNumber());
      const currentWbtcPrice = await this.instrument.getCurrentPrice();
      //assert.equal(currentWbtcPrice.toNumber(), strike.toNumber());
      console.log(`wbtc size ${currentWbtcPrice}`);
      console.log(`option size is ${strike}`);
    });
  });
}
