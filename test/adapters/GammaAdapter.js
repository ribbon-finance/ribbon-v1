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

  behavesLikeOTokens({
    name: "oToken",
    oTokenAddress: "0x9d3129BefDAac4aB2d6939DD1054A64dF7D84a11",
    underlying: ETH_ADDRESS,
    strikeAsset: USDC_ADDRESS,
    collateralAsset: WETH_ADDRESS,
    strikePrice: ether("1280"),
    expiry: "1614326400",
    optionType: CALL_OPTION_TYPE,
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
      } = params;

      this.underlying = underlying;
      this.strikeAsset = strikeAsset;
      this.collateralAsset = collateralAsset;
      this.strikePrice = strikePrice;
      this.expiry = expiry;
      this.optionType = optionType;
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
        const apiResponse = {
          price: "272.33041",
          guaranteedPrice: "272.33041",
          to: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
          value: "7280000000000000",
          gas: "330000",
          estimatedGas: "300000",
          gasPrice: "104000000000",
          protocolFee: "7280000000000000",
          minimumProtocolFee: "7280000000000000",
          buyTokenAddress: "0x9d3129BefDAac4aB2d6939DD1054A64dF7D84a11",
          sellTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          buyAmount: "10000000",
          sellAmount: "27233041",
          orders: [
            {
              chainId: 1,
              exchangeAddress: "0x61935cbdd02287b511119ddb11aeb42f1593b7ef",
              makerAddress: "0x75ea4d5a32370f974d40b404e4ce0e00c1554979",
              takerAddress: "0x0000000000000000000000000000000000000000",
              feeRecipientAddress: "0x1000000000000000000000000000000000000011",
              senderAddress: "0x0000000000000000000000000000000000000000",
              makerAssetAmount: "993750000",
              takerAssetAmount: "2706283448",
              makerFee: "0",
              takerFee: "0",
              expirationTimeSeconds: "1610003559",
              salt: "993483663792986880",
              makerAssetData:
                "0xf47261b00000000000000000000000009d3129befdaac4ab2d6939dd1054a64df7d84a11",
              takerAssetData:
                "0xf47261b0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
              makerFeeAssetData: "0x",
              takerFeeAssetData: "0x",
              signature:
                "0x1b5d41315eee8a82df7cc1541383e0e135d261834b71691cfd73357a03721c3cbc683079a19458e0ef2ab57daeaf1fb18ca4a272cf5d01b5ea922045e7905fdb9502",
            },
          ],
          allowanceTarget: "0xf740b67da229f2f10bcbd38a7979992fcc71b8eb",
          sellTokenToEthRate: "1200.351268",
          buyTokenToEthRate: "0",
        };

        const order = apiResponse.orders[0];

        const orderStruct = [
          order.makerAddress,
          order.takerAddress,
          order.feeRecipientAddress,
          order.senderAddress,
          order.makerAssetAmount,
          order.takerAssetAmount,
          order.makerFee,
          order.takerFee,
          order.expirationTimeSeconds,
          order.salt,
          order.makerAssetData,
          order.takerAssetData,
          order.makerFeeAssetData,
          order.takerFeeAssetData,
        ];

        console.log([
          this.optionTerms,
          apiResponse.to,
          apiResponse.buyTokenAddress,
          apiResponse.sellTokenAddress,
          orderStruct,
          order.signature,
          apiResponse.allowanceTarget,
          apiResponse.protocolFee,
        ]);

        await this.adapter.purchaseWithZeroEx(
          this.optionTerms,
          apiResponse.to,
          apiResponse.buyTokenAddress,
          apiResponse.sellTokenAddress,
          orderStruct,
          order.signature,
          apiResponse.allowanceTarget,
          apiResponse.protocolFee,
          {
            from: user,
            gas: parseInt(apiResponse.gas) + 100000,
            gasPrice: apiResponse.gasPrice,
            value: ether("10"),
          }
        );
      });
    });
  });
}
