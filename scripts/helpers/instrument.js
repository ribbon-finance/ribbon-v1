const web3 = require("./web3");
const IERC20JSON = require("../../build/contracts/IERC20.json");
const { sleep } = require("./utils");
module.exports = { depositAndMintDtoken };

async function depositAndMintDtoken(instrument, owner, mintAmount) {
  const collateralAsset = await instrument.methods.collateralAsset().call();
  const dToken = await instrument.methods.dToken().call();
  const dTokenERC20 = new web3.eth.Contract(IERC20JSON.abi, dToken);
  const collateralERC20 = new web3.eth.Contract(
    IERC20JSON.abi,
    collateralAsset
  );

  console.log(`Approving collateralAsset ${mintAmount}`);

  const approveReceipt = await collateralERC20.methods
    .approve(instrument._address, mintAmount)
    .send({ from: owner });
  console.log(
    `Approve txhash: https://kovan.etherscan.io/tx/${approveReceipt.transactionHash}\n`
  );
  sleep(60000);

  console.log("Performing an initial depositAndMint to mint dTokens");
  const mintReceipt = await instrument.methods
    .depositAndMint(mintAmount, mintAmount)
    .send({ from: owner });
  console.log(
    `Minting txhash: https://kovan.etherscan.io/tx/${mintReceipt.transactionHash}\n`
  );
  sleep(60000);

  const dTokenBalance = await dTokenERC20.methods.balanceOf(owner);

  if (dTokenBalance < mintAmount) {
    throw new Error(
      `dToken balance for ${owner} (${dTokenBalance}) is less than ${mintAmount}`
    );
  }
  console.log("Sufficient dToken balance for funding balancer pool.");

  return mintAmount;
}
