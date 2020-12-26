const { ether, constants } = require("@openzeppelin/test-helpers");

module.exports = {
  setupOTokenAndVaults,
};

const ETH_ADDRESS = constants.ZERO_ADDRESS;
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const PUT_OPTION_TYPE = 1;
const CALL_OPTION_TYPE = 2;

async function setupOTokenAndVaults(adapter, owner) {
  const oTokens = [
    {
      oTokenAddress: "0xb759e6731df19abD72e0456184890f87dCb6C518",
      expiry: "1608883200",
      underlying: ETH_ADDRESS,
      strikeAsset: USDC_ADDRESS,
      strikePrice: ether("500"),
      optionType: CALL_OPTION_TYPE,
      vaults: [
        "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
        "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
      ],
    },
    {
      oTokenAddress: "0x7EB6Dd0Cc2DF2EAe901f76A151cA82BB7be10d68",
      expiry: "1608883200",
      underlying: ETH_ADDRESS,
      strikeAsset: USDC_ADDRESS,
      strikePrice: ether("640"),
      optionType: CALL_OPTION_TYPE,
      vaults: [
        "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
        "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
      ],
    },
    {
      oTokenAddress: "0xef99E80D6963D801B1f2b4c61F780082D2642152",
      expiry: "1608278400",
      underlying: ETH_ADDRESS,
      strikeAsset: USDC_ADDRESS,
      strikePrice: ether("600"),
      optionType: PUT_OPTION_TYPE,
      vaults: [
        "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
        "0xC5Df4d5ED23F645687A867D8F83a41836FCf8811",
      ],
    },
    {
      oTokenAddress: "0x77fe93a60A579E4eD52159aE711794C6fb7CdeA7",
      expiry: "1608883200",
      underlying: ETH_ADDRESS,
      strikeAsset: USDC_ADDRESS,
      strikePrice: ether("520"),
      optionType: PUT_OPTION_TYPE,
      vaults: [
        "0x076C95c6cd2eb823aCC6347FdF5B3dd9b83511E4",
        "0x099ebcc539828ff4ced12c0eb3b4b2ece558fdb5",
      ],
    },
  ];

  const setOTokens = oTokens.map((oToken) => {
    return adapter.setOTokenWithTerms(
      oToken.strikePrice,
      oToken.optionType,
      oToken.oTokenAddress,
      { from: owner }
    );
  });
  await Promise.all(setOTokens);

  const setVaults = oTokens.map((oToken) => {
    return adapter.setVaults(oToken.oTokenAddress, oToken.vaults, {
      from: owner,
    });
  });
  await Promise.all(setVaults);
}
