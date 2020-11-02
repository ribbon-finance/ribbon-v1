const { accounts, contract } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const { ether, ZERO_ADDRESS } = require("@openzeppelin/test-helpers");

const Balancer = contract.fromArtifact("Balancer");
const MockBFactory = contract.fromArtifact("MockBFactory");
const MockBPool = contract.fromArtifact("MockBPool");
const MockERC20 = contract.fromArtifact("MockERC20");

describe("Balancer", function () {
  const [owner, user] = accounts;

  before(async function () {
    const mintAmount = ether("1000");
    this.bFactory = await MockBFactory.new({ from: owner });
    this.balancer = await Balancer.new({ from: owner });
    this.dToken = await MockERC20.new("dToken", "DTOKEN", mintAmount, {
      from: owner,
    });
    this.dai = await MockERC20.new("Dai Stablecoin", "DAI", mintAmount, {
      from: owner,
    });
  });

  describe("#initialize", () => {
    it("creates a new BPool", async function () {
      await this.balancer.initialize(
        this.bFactory.address,
        this.dToken.address,
        this.dai.address,
        ether("0.0001")
      );

      // check the balancer params are set correctly
      assert.equal(
        (await this.balancer.balancerMaxSlippage()).toString(),
        ether("0.0001")
      );
      assert.equal(await this.balancer.balancerDToken(), this.dToken.address);
      assert.equal(
        await this.balancer.balancerPaymentToken(),
        this.dai.address
      );
      assert.notEqual(await this.balancer.balancerPool(), ZERO_ADDRESS);
    });
  });

  describe("#sellToPool", () => {
    before(async function () {
      this.pool = await MockBPool.at(await this.balancer.balancerPool());
      await this.pool.setSpotPrice(ether("400")); // 400 DAI per DToken
      assert.equal(
        (
          await this.pool.getSpotPrice(this.dToken.address, this.dai.address)
        ).toString(),
        ether("400")
      );

      // just transfer some tokens to the pool
      await this.dai.transfer(this.pool.address, ether("500"), { from: owner });
      await this.dToken.transfer(this.balancer.address, ether("1"), {
        from: owner,
      });
    });

    it("sells to pool", async function () {
      await this.balancer.sellToPool(ether("1"), { from: user });
      assert.equal((await this.dai.balanceOf(user)).toString(), ether("400"));
      assert.equal(
        (await this.dToken.balanceOf(this.pool.address)).toString(),
        ether("1")
      );
    });
  });
});
