const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { constants, provider, BigNumber } = ethers;
const { parseEther } = ethers.utils;
const time = require("../helpers/time");
const { parseLog } = require("../helpers/utils");

const UNISWAP_ADDRESS = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
const SUSHISWAP_ADDRESS = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DIGG_ADDRESS = "0x798d1be841a82a273720ce31c822c61a67a601c3";
const SUSHISWAP_LP = "0x9a13867048e01c663ce8ce2fe0cdae69ff9f35e3";
const UNISWAP_LP = "0xe86204c4eddd2f70ee00ead6805f917671f56c52";
let user, recipient;

describe("UniswapAdapter", () => {
  let initSnapshotId, snapshotId;
  const gasPrice = ethers.utils.parseUnits("1", "gwei");

  before(async function () {
    const [, , userSigner, recipientSigner] = await ethers.getSigners();
    user = userSigner.address;
    recipient = recipientSigner.address;

    this.protocolName = "UNISWAP";
    this.nonFungible = true;

    const UniswapAdapter = await ethers.getContractFactory("UniswapAdapter");

    this.adapter = await UniswapAdapter.deploy(
      UNISWAP_ADDRESS,
      SUSHISWAP_ADDRESS,
      WBTC_ADDRESS,
      ETH_ADDRESS,
      UNISWAP_LP,
      SUSHISWAP_LP,
      DIGG_ADDRESS
    );
    this.adapter = this.adapter.connect(userSigner);
    const wethArtifact = await artifacts.readArtifact("IWETH");
    this.weth = new ethers.Contract(
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      wethArtifact.abi,
      ethers.provider
    );
    this.weth = this.weth.connect(userSigner);

    const tokenArtifact = await artifacts.readArtifact("ERC20");
    this.token = new ethers.Contract(
      "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      tokenArtifact.abi,
      ethers.provider
    );
    this.token = this.token.connect(userSigner);

    const uniswapArtifact = await artifacts.readArtifact("IUniswapV2Router02");
    this.uniswap = new ethers.Contract(
      "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
      uniswapArtifact.abi,
      ethers.provider
    );
    this.uniswap = this.uniswap.connect(userSigner);

    initSnapshotId = await time.takeSnapshot();
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

  coreUniswapTests({
    inputAddress: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    wbtcAmt: BigNumber.from("10"),
    ethAmt: BigNumber.from("10000000000000"),
    exchangeName: "UNISWAP",
  });

  coreUniswapTests({
    inputAddress: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    wbtcAmt: BigNumber.from("10"),
    ethAmt: BigNumber.from("10000000000000"),
    exchangeName: "SUSHISWAP",
  });

  function coreUniswapTests(params) {
    describe(`buying on ${params.exchangeName}`, () => {
      before(async function () {
        const { inputAddress, ethAmt, wbtcAmt, exchangeName } = params;
        this.ethAmt = ethAmt;
        this.wbtcAmt = wbtcAmt;
        this.exchangeName = exchangeName;
      });

      describe("#expectedAmountsOut", () => {
        time.revertToSnapshotAfterEach();

        it("handles invalid exchange for expectedWbtcOut", async function () {
          const promise = this.adapter.expectedWbtcOut(
            this.ethAmt,
            "MUNISWAP",
            {
              from: user,
            }
          );
          await expect(promise).to.be.revertedWith("invalid exchange");
        });
        it("handles invalid exchange for expectedDiggOut", async function () {
          const promise = this.adapter.expectedDiggOut(
            this.wbtcAmt,
            "MUNISWAP",
            {
              from: user,
            }
          );
          await expect(promise).to.be.revertedWith("invalid exchange");
        });
      });

      describe("#buyLp", () => {
        time.revertToSnapshotAfterEach();

        it("handles invalid exchange using eth", async function () {
          const promise = this.adapter.buyLp(
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            this.ethAmt,
            "MUNISWAP",
            0,
            0,
            {
              from: user,
              value: this.ethAmt,
            }
          );
          await expect(promise).to.be.revertedWith("invalid exchange");
        });

        it("handles invalid exchange using wbtc", async function () {
          const btc_amt = await this.token.balanceOf(user, { from: user });

          await this.weth.deposit({
            from: user,
            value: BigNumber.from("100000000000000000"),
          });
          await this.weth.approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
          await this.uniswap.swapExactTokensForTokens(
            BigNumber.from("1000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );
          const approval = await this.token.approve(
            this.adapter.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
          const promise = this.adapter.buyLp(
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            this.wbtcAmt,
            "MUNISWAP",
            0,
            0,
            {
              from: user,
            }
          );
          await expect(promise).to.be.revertedWith("invalid exchange");
        });

        it("reverts excessive input amt using eth", async function () {
          const promise = this.adapter.buyLp(
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            BigNumber.from(
              "10000000000000000000000000000000000000000000000000000"
            ),
            this.exchangeName,
            0,
            0,
            {
              from: user,
              value: this.amtEth,
            }
          );
          await expect(promise).to.be.revertedWith("not enough funds");
        });
        it("reverts excessive input amt using wbtc", async function () {
          const btc_amt = await this.token.balanceOf(user, { from: user });

          await this.weth.deposit({
            from: user,
            value: BigNumber.from("100000000000000000"),
          });
          await this.weth.approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
          await this.uniswap.swapExactTokensForTokens(
            BigNumber.from("1000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );
          const approval = await this.token.approve(
            this.adapter.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );

          const promise = this.adapter.buyLp(
            "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            BigNumber.from("10000000000000"),
            this.exchangeName,
            0,
            0,
            {
              from: user,
            }
          );
          await expect(promise).to.be.revertedWith("not enough funds");
        });

        it("valid purchase with eth", async function () {
          //console.log('checking state before purchase');
          await checkState(this.exchangeName, this.adapter.address, false);
          const promise = this.adapter.buyLp(
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            this.ethAmt,
            this.exchangeName,
            0,
            0,
            {
              from: user,
              value: this.ethAmt,
            }
          );
          //console.log('checking state after purchase');
          await checkState(this.exchangeName, this.adapter.address, true);
        });

        it("valid purchase with wbtc", async function () {
          //console.log('checking state before purchase');
          await checkState(this.exchangeName, this.adapter.address, false);
          const btc_amt = await this.token.balanceOf(user, { from: user });

          await this.weth.deposit({
            from: user,
            value: BigNumber.from("100000000000000000"),
          });
          await this.weth.approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
          await this.uniswap.swapExactTokensForTokens(
            BigNumber.from("1000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );
          const approval = await this.token.approve(
            this.adapter.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
          const promise = this.adapter.buyLp(
            "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            this.wbtcAmt,
            this.exchangeName,
            0,
            0,
            {
              from: user,
            }
          );
          //console.log('checking state after purchase');
          await checkState(this.exchangeName, this.adapter.address, true);
        });

        it("purchase with eth using expected amounts out from adapter", async function () {
          //console.log('checking state before purchase');
          await checkState(this.exchangeName, this.adapter.address, false);
          const expWbtc = await this.adapter.expectedWbtcOut(
            this.ethAmt,
            this.exchangeName,
            {
              from: user,
            }
          );
          const expDigg = await this.adapter.expectedDiggOut(
            expWbtc,
            this.exchangeName,
            {
              from: user,
            }
          );
          const promise = this.adapter.buyLp(
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            this.ethAmt,
            this.exchangeName,
            expWbtc - 1,
            expDigg - 1,
            {
              from: user,
              value: this.ethAmt,
            }
          );
          //console.log('checking state after purchase');
          await checkState(this.exchangeName, this.adapter.address, true);
        });

        it("purchase with wbtc using expected amountOuts from adapter", async function () {
          //console.log('checking state before purchase');
          await checkState(this.exchangeName, this.adapter.address, false);
          wbtc_amt = await this.token.balanceOf(user, { from: user });

          await this.weth.deposit({
            from: user,
            value: BigNumber.from("100000000000000000"),
          });
          await this.weth.approve(
            this.uniswap.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );
          await this.uniswap.swapExactTokensForTokens(
            BigNumber.from("1000000000000000"),
            0,
            [
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
              "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            ],
            user,
            BigNumber.from("10000000000000000000000000000000"),
            { from: user }
          );
          const approval = await this.token.approve(
            this.adapter.address,
            BigNumber.from("1000000000000000000000000000000000"),
            { from: user }
          );

          const expDigg = await this.adapter.expectedDiggOut(
            this.wbtcAmt,
            this.exchangeName,
            {
              from: user,
            }
          );
          const promise = this.adapter.buyLp(
            "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            this.wbtcAmt,
            this.exchangeName,
            0,
            expDigg - 1,
            {
              from: user,
            }
          );
          //console.log('checking state after purchase');
          await checkState(this.exchangeName, this.adapter.address, true);
        });
      });
    });
  }
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
    //console.log(`eth balance of adapter is ${ethBalanceAdapter}`);
    const wbtcBalanceAdapter = await this.wbtc.balanceOf(adapterAddress);
    //console.log(`wbtc balance of adapter is ${wbtcBalanceAdapter}`);
    const diggBalanceAdapter = await this.digg.balanceOf(adapterAddress);
    //console.log(`digg balance of adapter is ${diggBalanceAdapter}`);
    const lpBalance = await this.uniswapLp.balanceOf(user);
    //console.log(`lp balance of user is ${lpBalance}`);
    if (isAfter) {
      assert.isTrue(diggBalanceAdapter < 3);
      assert.isTrue(wbtcBalanceAdapter < 3);
      assert.isTrue(lpBalance > 0);
      assert.equal(ethBalanceAdapter, 0);
    }
  }
});


