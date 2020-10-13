include .env
export

.PHONY: lint test compile

lint:
	solhint "contracts/**/*.sol"

compile:
	npx truffle compile

test:
	npm test

verify:
	API_KEY=$$ETHERSCAN_API_KEY npx verify-on-etherscan --network kovan ./build/contracts/*
