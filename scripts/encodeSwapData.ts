import { ethers } from "ethers";
import axios from "axios";
import { Command } from "commander";

const program = new Command();
program.version("0.0.1");
program.requiredOption("-i, --ipfsHash <ipfsHash>", "IPFS Hash");

program.parse(process.argv);

async function fetchOrderJSON(ipfsHash: string) {
  const url = `https://ipfs.io/ipfs/${ipfsHash}`;
  const response = await axios.get(url);
  return response.data;
}

async function encodeSwapData(orderJSON: any) {
  const ABI = [
    {
      constant: false,
      inputs: [
        {
          components: [
            { internalType: "uint256", name: "nonce", type: "uint256" },
            { internalType: "uint256", name: "expiry", type: "uint256" },
            {
              components: [
                { internalType: "bytes4", name: "kind", type: "bytes4" },
                {
                  internalType: "address",
                  name: "wallet",
                  type: "address",
                },
                { internalType: "address", name: "token", type: "address" },
                {
                  internalType: "uint256",
                  name: "amount",
                  type: "uint256",
                },
                { internalType: "uint256", name: "id", type: "uint256" },
              ],
              internalType: "struct Types.Party",
              name: "signer",
              type: "tuple",
            },
            {
              components: [
                { internalType: "bytes4", name: "kind", type: "bytes4" },
                {
                  internalType: "address",
                  name: "wallet",
                  type: "address",
                },
                { internalType: "address", name: "token", type: "address" },
                {
                  internalType: "uint256",
                  name: "amount",
                  type: "uint256",
                },
                { internalType: "uint256", name: "id", type: "uint256" },
              ],
              internalType: "struct Types.Party",
              name: "sender",
              type: "tuple",
            },
            {
              components: [
                { internalType: "bytes4", name: "kind", type: "bytes4" },
                {
                  internalType: "address",
                  name: "wallet",
                  type: "address",
                },
                { internalType: "address", name: "token", type: "address" },
                {
                  internalType: "uint256",
                  name: "amount",
                  type: "uint256",
                },
                { internalType: "uint256", name: "id", type: "uint256" },
              ],
              internalType: "struct Types.Party",
              name: "affiliate",
              type: "tuple",
            },
            {
              components: [
                {
                  internalType: "address",
                  name: "signatory",
                  type: "address",
                },
                {
                  internalType: "address",
                  name: "validator",
                  type: "address",
                },
                { internalType: "bytes1", name: "version", type: "bytes1" },
                { internalType: "uint8", name: "v", type: "uint8" },
                { internalType: "bytes32", name: "r", type: "bytes32" },
                { internalType: "bytes32", name: "s", type: "bytes32" },
              ],
              internalType: "struct Types.Signature",
              name: "signature",
              type: "tuple",
            },
          ],
          internalType: "struct Types.Order",
          name: "order",
          type: "tuple",
        },
      ],
      name: "sellOptions",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  let iface = new ethers.utils.Interface(ABI);

  console.log("Order JSON:", orderJSON);
  const encoded = iface.encodeFunctionData("sellOptions", [orderJSON]);

  console.log(`Encoded hex data: ${encoded}`);
}

async function main() {
  const orderJSON = await fetchOrderJSON(program.ipfsHash);
  encodeSwapData(orderJSON);
}

main();
