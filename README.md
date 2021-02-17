# Ribbon Finance

## Getting Started

1. Install all the NodeJS dependencies with npm.

```
npm install
```

Double check that you have the correct versions installed. The Solidity compilation will fail if you have the wrong version of Truffle.

```
> npx truffle version
Truffle v5.1.61 (core: 5.1.61)
Solidity - 0.7.2 (solc-js)
Node v15.5.1
Web3.js v1.2.9
```

2. You can start compiling the Solidity code with Truffle.

```
npx truffle compile
```

3. To run the unit tests for a specific contract, run with mocha

```
mocha --timeout 200000 --exit --recursive test --exclude test/adapters/HegicAdapter.js
```

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
