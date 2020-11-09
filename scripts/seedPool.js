const program = require("commander");
const twinYieldJSON = require("../build/contracts/TwinYield.json");
const balancerJSON = require("../constants/abis/BPool.json");
const IERC20JSON = require("../build/contracts/IERC20.json");
const web3 = require("./helpers/web3");
const accounts = require("../constants/accounts");
const { depositAndMintDtoken } = require("./helpers/instrument");
const { sleep, wmul, wdiv } = require("./helpers/utils");

program.option("-n, --network <name>", "network", "kovan");

program
  .requiredOption("-i, --instrument <address>", "instrument")
  .option("-d, --dTokenAmount <amount>", "dtoken amount to seed", "0.1")
  .option("-p, --paymentAmount <amount>", "payment token amount to seed", "100")
  .requiredOption(
    "-a, --address <caller>",
    "caller",
    accounts[program.network].owner
  );

program.parse(process.argv);

async function joinPool() {
  const dTokenAmount = new web3.utils.BN(
    web3.utils.toWei(program.dTokenAmount, "ether")
  );
  const paymentAmount = new web3.utils.BN(
    web3.utils.toWei(program.paymentAmount, "ether")
  );
  const owner = program.address;

  const instrument = new web3.eth.Contract(
    twinYieldJSON.abi,
    program.instrument
  );
  const poolAddress = await instrument.methods.balancerPool().call();
  const dTokenAddress = await instrument.methods.dToken().call();
  const paymentAddress = await instrument.methods.paymentToken().call();
  const pool = new web3.eth.Contract(balancerJSON, poolAddress);

  const initialSupply = new web3.utils.BN(
    await pool.methods.totalSupply().call()
  );
  const dTokenBalance = new web3.utils.BN(
    await pool.methods.getBalance(dTokenAddress).call()
  );
  const ratio = wdiv(dTokenAmount, dTokenBalance);
  const newSupply = wmul(initialSupply, ratio);

  console.log(
    `Initial supply is ${initialSupply}, new supply is ${newSupply}, expansion ratio of ${web3.utils.fromWei(
      ratio
    )}`
  );

  const dToken = new web3.eth.Contract(IERC20JSON.abi, dTokenAddress);
  const paymentToken = new web3.eth.Contract(IERC20JSON.abi, paymentAddress);

  await depositAndMintDtoken(instrument, program.address, dTokenAmount);

  console.log("Approve dToken");
  const approveDTokenReceipt = await dToken.methods
    .approve(poolAddress, dTokenAmount)
    .send({ from: owner });
  console.log(
    `Approve txhash: https://kovan.etherscan.io/tx/${approveDTokenReceipt.transactionHash}\n`
  );
  sleep(60000);

  console.log("Approve payment");
  const approvePaymentReceipt = await paymentToken.methods
    .approve(poolAddress, paymentAmount)
    .send({ from: owner });
  console.log(
    `Approve txhash: https://kovan.etherscan.io/tx/${approvePaymentReceipt.transactionHash}\n`
  );
  sleep(60000);

  console.log("Calling joinPool...");
  const joinReceipt = await pool.methods
    .joinPool(newSupply, [dTokenAmount, paymentAmount])
    .send({ from: program.address });
  console.log(
    `joinPool txhash: https://kovan.etherscan.io/tx/${joinReceipt.transactionHash}\n`
  );
  sleep(60000);

  process.exit();
}

joinPool();
