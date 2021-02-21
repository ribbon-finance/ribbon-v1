const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const time = require("./helpers/time");
const { deployProxy, getDefaultArgs } = require("./helpers/utils");

let owner, user;

describe("RibbonOptionsVault", () => {
  let initSnapshotId;

  before(async function () {
    initSnapshotId = await time.takeSnapshot();

    [adminSigner, ownerSigner, userSigner] = await ethers.getSigners();
    owner = ownerSigner.address;
    user = userSigner.address;

    const { factory, protocolAdapterLib } = await getDefaultArgs();

    const initializeTypes = ["address", "address"];
    const initializeArgs = [owner, factory.address];

    this.vault = (
      await deployProxy(
        "RibbonOptionsVault",
        adminSigner,
        initializeTypes,
        initializeArgs,
        {
          libraries: {
            ProtocolAdapter: protocolAdapterLib.address,
          },
        }
      )
    ).connect(userSigner);
  });

  after(async () => {
    await time.revertToSnapShot(initSnapshotId);
  });

  describe("#deposit", () => {
    it("deposits successfully", async function () {
      await this.vault.deposit({ value: parseEther("1") });
    });
  });
});
