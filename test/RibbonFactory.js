const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const { provider } = ethers;

const { getDefaultArgs } = require("./helpers/utils.js");
const time = require("./helpers/time.js");
const { encodeCall } = require("@openzeppelin/upgrades");

const newInstrumentTypes = [
  "address",
  "address",
  "string",
  "string",
  "uint256",
  "uint256",
  "uint256",
  "address",
  "address",
  "address",
  "address",
  "address",
];
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

let admin, owner, user;
let userSigner;

describe("RibbonFactory", function () {
  before(async function () {
    [adminSigner, ownerSigner, userSigner] = await ethers.getSigners();
    admin = adminSigner.address;
    owner = ownerSigner.address;
    user = userSigner.address;

    const { factory, hegicAdapter, opynV1Adapter } = await getDefaultArgs();
    this.factory = factory.connect(ownerSigner);
    this.hegicAdapter = hegicAdapter;
    this.opynV1Adapter = opynV1Adapter;
  });

  it("initializes factory correctly", async function () {
    assert.equal(await this.factory.owner(), owner);

    // check the storage for admin
    assert.equal(
      ethers.utils.getAddress(
        "0x" +
          (await provider.getStorageAt(this.factory.address, ADMIN_SLOT)).slice(
            26
          )
      ),
      admin
    );
    assert.equal(await this.factory.instrumentAdmin(), admin);
  });

  it("reverts if any account other than owner calls", async function () {
    const initData = encodeCall("initialize", newInstrumentTypes, [
      owner,
      "0x0000000000000000000000000000000000000000",
      "test",
      "test",
      "32503680000",
      "42000000000",
      "1",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000002",
    ]);

    const tx = this.factory
      .connect(userSigner)
      .newInstrument("0x0000000000000000000000000000000000000002", initData, {
        from: user,
      });
    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
  });

  describe("#setAdapter", () => {
    let snapshotId;

    beforeEach(async () => {
      snapshotId = await time.takeSnapshot();
    });

    afterEach(async () => {
      await time.revertToSnapShot(snapshotId);
    });

    it("sets the adapter", async function () {
      const res = await this.factory.setAdapter(
        "TEST",
        "0x0000000000000000000000000000000000000001",
        { from: owner }
      );

      expect(res)
        .to.emit(this.factory, "AdapterSet")
        .withArgs(
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TEST")),
          "0x0000000000000000000000000000000000000001"
        );

      assert.equal(
        await this.factory.getAdapter("TEST"),
        "0x0000000000000000000000000000000000000001"
      );
      assert.equal((await this.factory.getAdapters()).length, 3);
    });

    it("reverts when not owner", async function () {
      await expect(
        this.factory
          .connect(userSigner)
          .setAdapter("TEST", "0x0000000000000000000000000000000000000001", {
            from: user,
          })
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("#getAdapter", () => {
    it("gets the hegic adapter", async function () {
      assert.equal(
        await this.factory.getAdapter("HEGIC"),
        this.hegicAdapter.address
      );
    });
  });

  describe("#adapters", () => {
    it("gets the adapters array", async function () {
      assert.equal(
        (await this.factory.getAdapters())[0],
        this.hegicAdapter.address
      );
    });
  });

  describe("#burnGasTokens", () => {
    it("cannot burn if not instrument", async function () {
      const tx = this.factory.burnGasTokens();
      await expect(tx).to.be.revertedWith("Caller is not instrument");
    });
  });
});
