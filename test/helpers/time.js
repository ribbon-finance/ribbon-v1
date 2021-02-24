const { ethers } = require("hardhat");
const { BigNumber } = ethers;

module.exports = {
  increase,
  increaseTo,
  takeSnapshot,
  revertToSnapShot,
  revertToSnapshotAfterTest,
  revertToSnapshotAfterEach,
};

// Increases ganache time by the passed duration in seconds
async function increase(duration) {
  if (!BigNumber.isBigNumber(duration)) {
    duration = BigNumber.from(duration);
  }

  if (duration.lt(BigNumber.from("0")))
    throw Error(`Cannot increase time by a negative amount (${duration})`);

  await ethers.provider.send("evm_increaseTime", [duration.toNumber()]);

  await ethers.provider.send("evm_mine");
}

/**
 * Beware that due to the need of calling two separate ganache methods and rpc calls overhead
 * it's hard to increase time precisely to a target point so design your test to tolerate
 * small fluctuations from time to time.
 *
 * @param target time in seconds
 */
async function increaseTo(target) {
  if (!BigNumber.isBigNumber(target)) {
    target = BigNumber.from(target);
  }

  const now = BigNumber.from((await ethers.provider.getBlock()).timestamp);

  if (target.lt(now))
    throw Error(
      `Cannot increase current time (${now}) to a moment in the past (${target})`
    );

  const diff = target.sub(now);
  return increase(diff);
}

async function takeSnapshot() {
  const snapshotId = await ethers.provider.send("evm_snapshot");
  return snapshotId;
}

async function revertToSnapShot(id) {
  await ethers.provider.send("evm_revert", [id]);
}

function revertToSnapshotAfterTest() {
  let snapshotId;

  before(async () => {
    snapshotId = await takeSnapshot();
  });
  after(async () => {
    await revertToSnapShot(snapshotId);
  });
}

function revertToSnapshotAfterEach(
  beforeEachCallback = async () => {},
  afterEachCallback = async () => {}
) {
  let snapshotId;

  beforeEach(async function () {
    snapshotId = await takeSnapshot();

    await beforeEachCallback.bind(this)();
  });
  afterEach(async () => {
    await afterEachCallback.bind(this)();

    await revertToSnapShot(snapshotId);
  });
}
