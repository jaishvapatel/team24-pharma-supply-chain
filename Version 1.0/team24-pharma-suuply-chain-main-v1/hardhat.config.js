require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "YOUR SEPOLIA RPC URL HERE",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] || "YOUR WALLET PRIVATE KEY HERE",
    },
  },
};