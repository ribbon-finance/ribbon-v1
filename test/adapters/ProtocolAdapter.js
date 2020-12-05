const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { assert } = require("chai");
const { ether, expectRevert, time } = require("@openzeppelin/test-helpers");

const [admin, owner, user] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

exports.shouldBehaveLikeProtocolAdapter = function () {
  describe("behaves like ProtocolAdapter", () => {
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

    describe("#premium", () => {
      it("gets the premium for call option", async function () {
        const premium = await this.adapter.premium(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          CALL_OPTION_TYPE,
          ether("1")
        );
        assert.equal(premium.toString(), this.callPremium);
      });

      it("gets the premium for put option", async function () {
        const premium = await this.adapter.premium(
          this.underlying,
          this.strikeAsset,
          this.expiry,
          this.strikePrice,
          PUT_OPTION_TYPE,
          ether("1")
        );
        assert.equal(premium.toString(), this.putPremium);
      });
    });
  });
};
