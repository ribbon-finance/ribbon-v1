const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
const HegicAdapter = contract.fromArtifact("HegicAdapter");
const MockHegicETHOptions = contract.fromArtifact("MockHegic");

describe("ProtocolAdapter", () => {
  const [admin, owner, user] = accounts;

  before(async function () {
    const hegic = await HegicAdapter.new();

    this.adapters = [];
  });
});

function premium(adapterContract) {}
