const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const {
  ether,
  ZERO_ADDRESS,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const MockERC20 = contract.fromArtifact("MockERC20");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const MockHegicETHOptions = contract.fromArtifact("MockHegicETHOptions");
const MockHegicWBTCOptions = contract.fromArtifact("MockHegicWBTCOptions");
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const [admin, owner, hegicPool, hegicSettlementFeeRecipient] = accounts;

describe("ProtocolAdapter", () => {
  before(async function () {
    const hegicAdapter = await initHegicAdapter(
      hegicPool,
      hegicSettlementFeeRecipient
    );

    this.adapters = [hegicAdapter];
  });

  describe("#premium", () => {
    it("shows premium", async function () {});
  });
});

async function initHegicAdapter(pool, settlementFeeRecipient) {
  const mintAmount = ether("1000");
  const WBTC = await MockERC20.new("Wrapped Bitcoin", "WBTC", mintAmount, {
    from: owner,
  });
  const ethOptions = await MockHegicETHOptions.new(
    pool,
    settlementFeeRecipient,
    { from: admin }
  );
  const wbtcOptions = await MockHegicETHOptions.new(
    pool,
    settlementFeeRecipient,
    { from: admin }
  );

  const adapter = await HegicAdapter.new(
    ethOptions.address,
    wbtcOptions.address,
    ETH_ADDRESS,
    WBTC.address
  );
  return adapter;
}

function premium(adapterContract) {}
