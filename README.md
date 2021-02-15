# Ribbon Finance

## Deployments

Ribbon uses truffle for migrations and deployments.

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

3. Next, to create an instrument, run this command. The `-e` parameter specifies the expiry of the instrument contract.

```
node ./scripts/addRibbonVolatility.js -e 1615507200 -n 'ETHVOL-12MAR2021' -s 'ETHVOL-12MAR2021' -N mainnet
```

Check the `--help` for more information on the parameters.
