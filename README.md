# dojima-finance

## Deployments

Doji uses truffle for migrations and deployments.

1. First, run the truffle migrations.

```
npx truffle migrate --network kovan
```

This will update the `constants/deployments.json` file for the kovan network. If this is an upgrade, commit it into Git. This helps other scripts that rely on it to use the latest version of the contracts.

2. To programmatically verify the deployed contracts, run the command:

```
npm run verify
```

The command automates the contract verification process with Etherscan.

3. Next, to create an instrument, run this command. The `-x` parameter specifies the strike price of the instrument contract.

```
node ./scripts/addTwinYield.js -x 500
```

Other parameters such as `--expiry` specify the contract expiry. These parameters can be set manually. Check the `--help` for more information.

After that, you will need to manually verify the instrument proxy with Etherscan, e.g. https://kovan.etherscan.io/proxyContractChecker?a=0x6bCf7bD4F09f1B556C4bD58A00EE944d9c46e2f2.
