const { assert } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, provider, getContractAt } = ethers;
const { parseEther, hexZeroPad, keccak256 } = ethers.utils;

const { getDefaultArgs, parseLog } = require("../helpers/utils");

const FORK_BLOCK = 12262830;
const UPGRADE_ADMIN = "0x223d59FA315D7693dF4238d1a5748c964E615923";
const THETA_VAULT = "0x0FABaF48Bbf864a3947bdd0Ba9d764791a60467A";
const PROTOCOL_ADAPTER_LIB = "0x3fa76827575Bb99ba4e56Dc39562771921f11E16";
const SWAP_ADDRESS = "0x4572f2554421Bd64Bef1c22c8a81840E8D496BeA";

const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const RANDOM_USER_ADDRESS = "0xb8a1ef5584564b0fda3086cc715b76de71de21ed";

// Used to query the user's balance
const USER_BALANCE_KEY = keccak256(
  "0x" +
    hexZeroPad(RANDOM_USER_ADDRESS, 32).slice(2) +
    hexZeroPad(BigNumber.from("151").toHexString(), 32).slice(2)
);

const OWNER_ADDRESS = "0xfce3a97b5f1d3403f481903da3679039f522089c";
const SPENDER_ADDRESS = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

const ALLOWANCE_KEY = keccak256(
  "0x" +
    hexZeroPad(SPENDER_ADDRESS, 32).slice(2) +
    keccak256(
      "0x" +
        hexZeroPad(OWNER_ADDRESS, 32).slice(2) +
        hexZeroPad(BigNumber.from("152").toHexString(), 32).slice(2)
    ).slice(2)
);

let userSigner;

describe("RibbonOptionsVault Upgrade", () => {
  describe("Upgrade from 4ee578b96aefa663458ec8f871732fb21fa0ceb9", () => {
    before(async function () {
      // We need to checkpoint the contract on mainnet to a past block before the upgrade happens
      // This means the `implementation` is pointing to an old contract
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.TEST_URI,
              blockNumber: FORK_BLOCK,
            },
          },
        ],
      });

      this.proxy = await getContractAt("AdminUpgradeabilityProxy", THETA_VAULT);
      this.vault = await getContractAt("RibbonThetaVault", THETA_VAULT);
      this.vaultAddress = THETA_VAULT;
      this.getVaultStorage = async (index) =>
        provider.getStorageAt(this.vaultAddress, index);

      this.storageLayout = [
        [
          ADMIN_SLOT,
          "0x000000000000000000000000223d59fa315d7693df4238d1a5748c964e615923",
        ],
        [
          0,
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        ], // initializable
        [
          1,
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        ], // reentrancy
        [
          101,
          "0x00000000000000000000000077da011d5314d80be59e939c2f7ec2f702e1dcc4",
        ], // owner
        [
          USER_BALANCE_KEY,
          "0x00000000000000000000000000000000000000000000001ace8efb9cecbae1a0",
        ], // balances
        [
          ALLOWANCE_KEY,
          "0xffffffffffffffffffffffffffffffffffffffffffffffff91bf4721b3f1ef56",
        ], // allowance
        [
          153,
          "0x0000000000000000000000000000000000000000000000359d7bf78261a9c9f3",
        ], // totalSupply()
        [
          154,
          "0x526962626f6e20455448205468657461205661756c740000000000000000002c",
        ], // Ribbon ETH Theta Vault
        [
          155,
          "0x724554482d544845544100000000000000000000000000000000000000000014",
        ], // symbol - rETH-THETA
        [
          156,
          "0x0000000000000000000000000000000000000000000000000000000000000012",
        ], // decimals - 18
        [
          201,
          "0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        ], // asset [deprecated] - WETH
        [
          202,
          "0x00000000000000000000000077da011d5314d80be59e939c2f7ec2f702e1dcc4",
        ], // manager
        [
          203,
          "0x000000000000000000000000286beb9d0b5af118e25932dc6f3e7015297b5a2b",
        ], // nextOption
        [
          204,
          "0x0000000000000000000000000000000000000000000000000000000060792b07",
        ], // nextOptionReadyAt
        [
          205,
          "0x000000000000000000000000286beb9d0b5af118e25932dc6f3e7015297b5a2b",
        ], // currentOption
        [
          206,
          "0x000000000000000000000000000000000000000000000030b138cdc904e9f79b",
        ], // lockedAmount
        [
          207,
          "0x00000000000000000000000000000000000000000000003635c9adc5dea00000",
        ], // cap
        [
          208,
          "0x0000000000000000000000000000000000000000000000000011c37937e08000",
        ], // instantWithdrawalFee
        [
          209,
          "0x0000000000000000000000006adeb4fddb63f08e03d6f5b9f653be8b65341b35",
        ],
      ];

      this.validateStorage = async () => {
        for (let i = 0; i < this.storageLayout.length; i++) {
          const [index, expectedStorageVal] = this.storageLayout[i];

          const actualStorageVal = await this.getVaultStorage(index);
          assert.equal(actualStorageVal, expectedStorageVal);
        }

        // Ownable
        assert.equal(
          await this.vault.owner(),
          "0x77DA011d5314D80BE59e939c2f7EC2F702E1DCC4"
        );

        // ERC20
        assert.equal(
          (await this.vault.totalSupply()).toString(),
          "989025371732052658675"
        );
        assert.equal(
          (await this.vault.balanceOf(RANDOM_USER_ADDRESS)).toString(),
          "494499456386359550368"
        );
        assert.equal(
          (
            await this.vault.allowance(OWNER_ADDRESS, SPENDER_ADDRESS)
          ).toString(),
          "115792089237316195423570985008687907853269984665640564039449639454905549844310"
        );
        assert.equal(await this.vault.name(), "Ribbon ETH Theta Vault");
        assert.equal(await this.vault.symbol(), "rETH-THETA");

        // OptionsVaultStorageV1
        assert.equal(
          await this.vault.manager(),
          "0x77DA011d5314D80BE59e939c2f7EC2F702E1DCC4"
        );
        assert.equal(
          await this.vault.nextOption(),
          "0x286BeB9d0b5aF118E25932dc6F3e7015297b5A2b"
        );
        assert.equal(
          (await this.vault.nextOptionReadyAt()).toNumber(),
          1618553607
        );
        assert.equal(
          await this.vault.currentOption(),
          "0x286BeB9d0b5aF118E25932dc6F3e7015297b5A2b"
        );
        assert.equal(await this.vault.lockedAmount(), "898213898544722081691");
        assert.equal(await this.vault.cap(), "1000000000000000000000");
        assert.equal(
          await this.vault.instantWithdrawalFee(),
          "5000000000000000"
        );
        assert.equal(
          await this.vault.feeRecipient(),
          "0x6adEB4FDdB63F08E03d6f5b9f653bE8b65341B35"
        );

        assert.equal(await this.vault.asset(), this.asset);
      };

      const { factory, registry } = await getDefaultArgs();
      this.asset = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      this.strikeAsset = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      this.factory = factory;
      this.registry = registry;
      this.tokenDecimals = 18;
      this.minimumSupply = BigNumber.from("10").pow("10").toString();
      this.isPut = false;

      // Fund & impersonate the admin account
      [userSigner] = await ethers.getSigners();

      await userSigner.sendTransaction({
        to: UPGRADE_ADMIN,
        value: parseEther("0.5"),
      });

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UPGRADE_ADMIN],
      });
    });

    after(async () => {
      // Reset back to the original forked block
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.TEST_URI,
              blockNumber: 12321078,
            },
          },
        ],
      });
    });

    it("performs a sanity check of the storage slots before upgrade", async function () {
      await this.validateStorage();

      // old implementation
      assert.equal(
        await this.getVaultStorage(IMPLEMENTATION_SLOT),
        "0x000000000000000000000000ed61372660aeb0776d5385df2c5f99a462de0245"
      );
    });

    it("performs upgrade and storage is intact", async function () {
      const VaultContract = await ethers.getContractFactory(
        "RibbonThetaVault",
        {
          libraries: {
            ProtocolAdapter: PROTOCOL_ADAPTER_LIB,
          },
        }
      );

      const newLogicContract = await VaultContract.deploy(
        this.asset,
        this.factory.address,
        this.registry.address,
        this.asset,
        this.strikeAsset,
        SWAP_ADDRESS,
        this.tokenDecimals,
        this.minimumSupply,
        this.isPut
      );

      const adminSigner = await provider.getSigner(UPGRADE_ADMIN);

      const res = await this.proxy
        .connect(adminSigner)
        .upgradeTo(newLogicContract.address);
      const receipt = await res.wait();

      const log = await parseLog("AdminUpgradeabilityProxy", receipt.logs[0]);
      assert.equal(log.args.implementation, newLogicContract.address);

      assert.equal(
        await this.getVaultStorage(IMPLEMENTATION_SLOT),
        "0x000000000000000000000000" +
          newLogicContract.address.slice(2).toLowerCase()
      );

      // now that we know that the implementation is set, we need to verify that all the variables are still the same as before
      await this.validateStorage();

      assert.isFalse(await this.vault.isPut());
    });
  });
});
