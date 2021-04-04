const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const time = require("../helpers/time");
const { constants, provider, BigNumber } = ethers;

const SUSHISWAP_ADDRESS = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const DIGG_ADDRESS = "0x798d1be841a82a273720ce31c822c61a67a601c3";
const SUSHISWAP_LP = "0x9a13867048e01c663ce8ce2fe0cdae69ff9f35e3";
let user, recipient;

describe("UniswapAdapter", () => {
  let initSnapshotId, snapshotId;
  const gasPrice = ethers.utils.parseUnits("1", "gwei");
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

  before(async function () {
    const [, , userSigner, recipientSigner] = await ethers.getSigners();
    user = userSigner.address;
    recipient = recipientSigner.address;

    this.protocolName = "UNISWAP";
    this.nonFungible = true;

    const UniswapAdapter = await ethers.getContractFactory("UniswapAdapter");

    this.adapter = await UniswapAdapter.deploy(
      SUSHISWAP_ADDRESS,
      WBTC_ADDRESS,
      WETH_ADDRESS,
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
    ethAmt: BigNumber.from("10000000000000"),
  });
  coreUniswapTests({
    ethAmt: BigNumber.from("100000000000000000000"),
  });

  function coreUniswapTests(params) {
    describe(`buying amount of ${params.ethAmt}`, () => {
      before(async function () {
        const { ethAmt } = params;
        this.ethAmt = ethAmt;
      });

      describe("#buyLp", () => {
        time.revertToSnapshotAfterEach();

        it("reverts excessive input amt using eth", async function () {
          const expWbtc = await this.adapter.expectedWbtcOut(this.ethAmt, {
            from: user,
          });
          const inputVars = await this.adapter.expectedDiggOut(expWbtc, {
            from: user,
          });
          const trade_amt = inputVars[1];
          const promise = this.adapter.buyLp(
            BigNumber.from(
              "10000000000000000000000000000000000000000000000000000"
            ),
            trade_amt,
            0,
            0,
            {
              from: user,
              value: this.amtEth,
            }
          );
          await expect(promise).to.be.revertedWith("not enough funds");
        });

        it("valid purchase with eth", async function () {
          //console.log('checking state before purchase');
          const beforeBals = await checkState(this.adapter.address, false);
          const expWbtc = await this.adapter.expectedWbtcOut(this.ethAmt, {
            from: user,
          });
          const inputVars = await this.adapter.expectedDiggOut(expWbtc, {
            from: user,
          });
          const trade_amt = inputVars[1];
          const res = await this.adapter.buyLp(this.ethAmt, trade_amt, 0, 0, {
            from: user,
            value: this.ethAmt,
          });
          const receipt = await res.wait();
          assert.isAtMost(receipt.gasUsed.toNumber(), 500000);
          //console.log('checking state after purchase');
          const afterBals = await checkState(this.adapter.address, true);
          checkBalances(beforeBals, afterBals, expWbtc.toNumber());
        });

        it("purchase with eth using expected amounts out from adapter", async function () {
          //console.log('checking state before purchase');
          const beforeBals = await checkState(this.adapter.address, false);
          const expWbtc = await this.adapter.expectedWbtcOut(this.ethAmt, {
            from: user,
          });
          const inputVars = await this.adapter.expectedDiggOut(expWbtc, {
            from: user,
          });
          const expDigg = inputVars[0];
          const trade_amt = inputVars[1];

          const res = await this.adapter.buyLp(
            this.ethAmt,
            trade_amt,
            expWbtc - 1,
            expDigg - 1,
            {
              from: user,
              value: this.ethAmt,
            }
          );
          const receipt = await res.wait();
          assert.isAtMost(receipt.gasUsed.toNumber(), 500000);
          //console.log('checking state after purchase');
          const afterBals = await checkState(this.adapter.address, true);
          checkBalances(beforeBals, afterBals, expWbtc.toNumber());
        });
      });
    });
  }

  async function checkBalances(beforeBals, afterBals, wbtcAmt) {
    //digg balance should not change
    assert.equal(afterBals[1].toNumber(), beforeBals[1].toNumber());
    //wbtc bal should equal the wbtc input from the user + before pool balance - any leftover wbtc in the contract
    assert.equal(
      beforeBals[0].toNumber() + wbtcAmt - afterBals[2],
      afterBals[0].toNumber()
    );
  }
  async function checkState(adapterAddress, isAfter) {
    const [, , userSigner, recipientSigner] = await ethers.getSigners();
    user = userSigner.address;
    recipient = recipientSigner.address;
    lpAddress = SUSHISWAP_LP;
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
    // console.log(`wbtc balance of adapter is ${wbtcBalanceAdapter}`);
    const diggBalanceAdapter = await this.digg.balanceOf(adapterAddress);
    // console.log(`digg balance of adapter is ${diggBalanceAdapter}`);
    const lpBalance = await this.uniswapLp.balanceOf(user);
    //console.log(`lp balance of user is ${lpBalance}`);
    const reserveBals = await this.uniswapLp.getReserves();
    //console.log(reserveBals.reserve0.toString());
    if (isAfter) {
      assert.isTrue(diggBalanceAdapter < 5);
      assert.isTrue(wbtcBalanceAdapter < 5);
      assert.isTrue(lpBalance > 0);
      assert.equal(ethBalanceAdapter, 0);
    }
    return [reserveBals.reserve0, reserveBals.reserve1, wbtcBalanceAdapter];
  }
});
