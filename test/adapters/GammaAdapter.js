const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
  BN,
  ether,
  constants,
  time,
  expectRevert,
  expectEvent,
  balance,
} = require("@openzeppelin/test-helpers");
const { assert } = require("chai");
const helper = require("../helper.js");
const GammaAdapter = contract.fromArtifact("GammaAdapter");
const IERC20 = contract.fromArtifact("IERC20");
const ZERO_EX_API_RESPONSES = require("../fixtures/GammaAdapter.json");

const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_EX_EXCHANGE = "0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef";
const OTOKEN_FACTORY = "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ETH_ADDRESS = constants.ZERO_ADDRESS;
const [admin, owner, user, recipient] = accounts;

const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

describe("GammaAdapter", () => {
  let initSnapshotId;
  const gasPrice = web3.utils.toWei("10", "gwei");

  before(async function () {
    this.protocolName = "OPYN_GAMMA";
    this.nonFungible = false;

    this.adapter = await GammaAdapter.new(
      OTOKEN_FACTORY,
      WETH_ADDRESS,
      ZERO_EX_EXCHANGE,
      UNISWAP_ROUTER,
      {
        from: owner,
      }
    );

    const snapShot = await helper.takeSnapshot();
    initSnapshotId = snapShot["result"];
  });

  after(async () => {
    await helper.revertToSnapShot(initSnapshotId);
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

  describe("#lookupOtoken", () => {
    it("looks oToken correctly", async function () {
      const oTokenAddress = "0x60ad22806B89DD17B2ecfe220c3712A2c86dfFFE";

      const actualOTokenAddress = await this.adapter.lookupOToken([
        constants.ZERO_ADDRESS,
        USDC_ADDRESS,
        WETH_ADDRESS,
        "1614326400",
        ether("800"),
        CALL_OPTION_TYPE,
      ]);
      assert.equal(actualOTokenAddress, oTokenAddress);
    });
  });

  // behavesLikeOTokens({
  //   name: "oToken",
  //   oTokenAddress: "0x9d3129BefDAac4aB2d6939DD1054A64dF7D84a11",
  //   underlying: ETH_ADDRESS,
  //   strikeAsset: USDC_ADDRESS,
  //   collateralAsset: WETH_ADDRESS,
  //   strikePrice: ether("1280"),
  //   expiry: "1614326400",
  //   optionType: CALL_OPTION_TYPE,
  // });

  // Call ITM
  behavesLikeOTokens({
    name: "Call ITM",
    oTokenAddress: "0x3cF86d40988309AF3b90C14544E1BB0673BFd439",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: ether("960"),
    expiry: "1614326400",
    optionType: CALL_OPTION_TYPE,
  });

  behavesLikeOTokens({
    name: "Call OTM",
    oTokenAddress: "0x8fF78Af59a83Cb4570C54C0f23c5a9896a0Dc0b3",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: ether("1480"),
    expiry: "1610697600",
    optionType: CALL_OPTION_TYPE,
  });

  behavesLikeOTokens({
    name: "Put OTM",
    oTokenAddress: "0x006583fEea92C695A9dE02C3AC2d4cd321f2F341",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: USDC_ADDRESS,
    strikePrice: ether("800"),
    expiry: "1610697600",
    optionType: PUT_OPTION_TYPE,
  });
});

function behavesLikeOTokens(params) {
  describe(`${params.name}`, () => {
    before(async function () {
      const {
        underlying,
        strikeAsset,
        collateralAsset,
        strikePrice,
        expiry,
        optionType,
        oTokenAddress,
      } = params;

      this.oTokenAddress = oTokenAddress;
      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.collateralAsset = collateralAsset;
      this.strikePrice = strikePrice;
      this.expiry = expiry;
      this.optionType = optionType;
      this.apiResponse = ZERO_EX_API_RESPONSES[oTokenAddress];

      this.optionTerms = [
        this.underlying,
        this.strikeAsset,
        this.collateralAsset,
        this.strikePrice,
        this.expiry,
        this.optionType,
      ];
    });

    describe("#purchaseWithZeroEx", () => {
      it("purchases with 0x exchange", async function () {
        await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          this.apiResponse.to,
          this.apiResponse.buyTokenAddress,
          this.apiResponse.sellTokenAddress,
          this.apiResponse.to,
          this.apiResponse.protocolFee,
          this.apiResponse.buyAmount,
          this.apiResponse.sellAmount,
          this.apiResponse.data,
          {
            from: user,
            gasPrice: this.apiResponse.gasPrice,
            value: ether("10"),
          }
        );
      });
    });
  });
}
