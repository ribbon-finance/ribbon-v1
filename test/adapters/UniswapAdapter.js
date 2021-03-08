const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { constants, provider, BigNumber } = ethers;
const { parseEther } = ethers.utils;
const time = require("../helpers/time");
const { parseLog } = require("../helpers/utils");

const UNISWAP_ADDRESS = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
const SUSHISWAP_ADDRESS = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const DIGG_ADDRESS = "0x798d1be841a82a273720ce31c822c61a67a601c3";
const SUSHISWAP_LP = "0x9a13867048e01c663ce8ce2fe0cdae69ff9f35e3";
const UNISWAP_LP = "0xe86204c4eddd2f70ee00ead6805f917671f56c52";
let user, recipient;


describe("UniswapAdapter", () => {
          let initSnapshotId, snapshotId;
          const gasPrice = ethers.utils.parseUnits("10", "gwei");

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

          describe("#ProtectedSlippage", () => {
                    beforeEach(async () => {
                                   snapshotId = await time.takeSnapshot();
                                 });
                    afterEach(async () => {
                                    await time.revertToSnapShot(snapshotId);
                                 });
                   it("wont let non owner modify slippage", async function () {
                                const promise = this.adapter.modifySlippage(1, {from:user});
                                await expect(promise).to.be.revertedWith('Ownable: caller is not the owner');
                   });
                   });

         describe("#purchase", () => {
                    beforeEach(async () => {
                                    snapshotId = await time.takeSnapshot();
                                 });

                    afterEach(async () => {
                                    await time.revertToSnapShot(snapshotId);
                                 });

                    it("buys through sushiswap with eth", async function () {
                                 //const wbtc = await ethers.getContractAt("IERC20", '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599');
                                 //const Wbtc = await wbtc.attach('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599');
                                // const approval = await wbtc.approve(this.adapter.address,  BigNumber.from("1"), {from:user});
                                 const promise = this.adapter.buyLp(
                                         '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                                         BigNumber.from("10000000000000000"),
                                         'SUSHISWAP',

                                         {
                                           from: user,
                                           value: BigNumber.from("10000000000000000")
                                         }
                                );

                        });


                        it("buys through uniswap with eth", async function () {
                                const promise = this.adapter.buyLp(
                                         '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                                         BigNumber.from("10000000000000000"),
                                         'UNISWAP',
                                         {
                                          from:user,
                                          value: BigNumber.from("10000000000000000"),
                                         }
                                );
                        });

                        it("handles invalid exchange", async function () {
                                 const promise = this.adapter.buyLp(
                                        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                                         BigNumber.from("1"),
                                         'MUNISWAP',
                                         {
                                          from: user,
                                          value:  BigNumber.from("1")
                                         }
                                );
                                await expect(promise).to.be.revertedWith('invalid exchange');
                        });

                        it("handles excessive input amt uniswap", async function () {
                                const promise = this.adapter.buyLp(
                                         '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                                          BigNumber.from("110000000000000"),
                                          "UNISWAP",
                                          {
                                           from: user,
                                           value: BigNumber.from("100000000000000"),
                                          }
                                );
                                await expect(promise).to.be.revertedWith('not enough funds');
                        });

                        it("handles excessive input amt sushiswap", async function () {
                                const promise = this.adapter.buyLp(
                                         '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                                         BigNumber.from("110000000000000"),
                                         "UNISWAP",
                                        {
                                         from: user,
                                         value: BigNumber.from("100000000000000"),
                                        }
                                );
                                await expect(promise).to.be.revertedWith('not enough funds');
                        });

                  //  it("buys through uniswap with wbtc", async function () {
                //              const Box = await ethers.getContractFactory("ERC20");
                //              const box = await Box.attach('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599');
                //              const promise = this.adapter.buyLp(
                //                      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
                //                      BigNumber.from("1"),
                //                      'UNISWAP',

                //                      {
                //                      from: user
                //                      }
                //              );
                //      });

        });
});