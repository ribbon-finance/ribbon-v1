# Ribbon Finance

Ribbon Finance is a new protocol that helps users access crypto structured products for DeFi. It combine options, futures, and fixed income to improve a portfolio's risk-return profile. Please review our [documentation](http://docs.ribbon.finance/) for details about the structured products.

## Getting Started

We use Hardhat for compiling and testing, and currently use Truffle for running migrations & deployments. We are planning to move to doing deployments using Hardhat scripts in the future.

0. Install Node 12.3.0 with `nvm`

```sh
nvm install 12.3.0

nvm use 12.3.0
```

1. Install all the NodeJS dependencies with yarn.

```sh
yarn install
```

2. You can start compiling the Solidity code with Hardhat.

```sh
npx hardhat compile
```

3. You will need access to an archive node to run tests, since the tests use forked mainnet state. Create a .env file with a `TEST_URI`. Ask @kenchangh for access to archive node.

```sh
TEST_URI=<add node url here>
```

4. Run the unit tests with the command:

```sh
npx hardhat test
```

To run the unit tests for a specific unit test, you can run the tests directly with mocha

```sh
npx mocha --timeout 20000 --exit test/adapters/HegicAdapter.js -g 'purchase'
```

## Deployments

Ribbon uses truffle for migrations and deployments.

1. First, run the truffle migrations.

```sh
# This runs all the migration scripts from the beginning.
npx truffle migrate --network kovan

# To run individual migration files, do:
npx truffle migrate --network kovan -f 1 --to 3
```

This will update the `constants/deployments.json` file for the kovan network. If this is an upgrade, commit it into Git. This helps other scripts that rely on it to use the latest version of the contracts.

2. To programmatically verify the deployed contracts, run the command:

```sh
yarn verify
```

The command automates the contract verification process on Etherscan.

## Running scripts

Scripts are written in Typescript. To run them, we use the `ts-node` installed:

```
yarn run ts-node ./scripts/encodeSwapData.ts
```

## Linting & Formatting

We use a combination of Prettier, ESLint and Solhint for linting and formatting.

```sh
# Formatting solidity files
yarn lint:sol:prettier

# Linting solidity
yarn lint:sol:fix

# Formatting test files
yarn lint:test:prettier

# Linting test files
yarn lint:test:fix
```

## Security tooling

We are using Slither to detect common vulnerabilities and exploits. To get started, compile and merge the contract files.

```sh
npx truffle compile
yarn merge-contracts
```

The merged contract files are in the `build/merged/` directory.

Because it's a pain to fix the merge results, we have already pre-merged the major contracts. Run slither on individual contract files:

```sh
slither merged-contracts/RibbonCoveredCall.sol
slither merged-contracts/RibbonFactory.sol
slither merged-contracts/GammaAdapter.sol
slither merged-contracts/ProtocolAdapter.sol
```

## Test coverage

We use solidity-coverage for testing contract coverage. Run:

```
yarn coverage
```

And then you can browse the `coverage/index.html`.
