// scripts/deploy.js
// Deploys the PharmaceuticalSupplyChain contract and prints its address.

const hre = require("hardhat");

async function main() {
  console.log("Deploying PharmaceuticalSupplyChain contract...\n");

  const PharmaSC = await hre.ethers.getContractFactory("PharmaceuticalSupplyChain");
  const contract = await PharmaSC.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`Contract deployed to: ${address}`);
  console.log(`Admin (deployer):     ${(await hre.ethers.getSigners())[0].address}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
