const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const { ether, constants } = require("@openzeppelin/test-helpers");
const { shouldBehaveLikeProtocolAdapter } = require("./ProtocolAdapter");
const MockERC20 = contract.fromArtifact("MockERC20");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const MockHegicETHOptions = contract.fromArtifact("MockHegicETHOptions");
const MockHegicWBTCOptions = contract.fromArtifact("MockHegicWBTCOptions");
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const [admin, owner, _, pool, settlementFeeRecipient] = accounts;

describe("HegicAdapter", () => {
  before(async function () {
    const mintAmount = ether("1000");
    const WBTC = await MockERC20.new("Wrapped Bitcoin", "WBTC", mintAmount, {
      from: owner,
    });
    const ethOptions = await MockHegicETHOptions.new(
      pool,
      settlementFeeRecipient,
      { from: admin }
    );
    const wbtcOptions = await MockHegicWBTCOptions.new(
      pool,
      settlementFeeRecipient,
      { from: admin }
    );

    this.adapter = await HegicAdapter.new(
      ethOptions.address,
      wbtcOptions.address,
      ETH_ADDRESS,
      WBTC.address
    );

    this.underlying1 = ETH_ADDRESS;
    this.underlying2 = WBTC.address;
    this.strikeAsset = constants.ZERO_ADDRESS;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    this.expiry = Math.floor(expiryDate.getTime() / 1000);
    this.strikePrice = ether("500");

    // test cases
    this.protocolName = "HEGIC";
    this.nonFungible = true;

    // premium
    this.callPremium = ether("0.028675");
    this.putPremium = ether("0.028675");
  });

  shouldBehaveLikeProtocolAdapter();
});
