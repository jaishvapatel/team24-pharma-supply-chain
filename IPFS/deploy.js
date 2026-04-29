/**
 * deploy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deploys PharmaceuticalSupplyChain and outputs the address.
 * After deployment, copy the contract address to your .env file:
 *   REACT_APP_CONTRACT_ADDRESS=<deployed address>
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { ethers } = require("hardhat");
const fs         = require("fs");
const path       = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  const Factory  = await ethers.getContractFactory("PharmaceuticalSupplyChain");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ PharmaceuticalSupplyChain deployed to:", address);
  console.log("   Network:", (await ethers.provider.getNetwork()).name);

  // ── Write ABI + address to frontend ──────────────────────────────────────
  const abiDir = path.join(__dirname, "../frontend/src/abi");
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });

  // Copy ABI
  const artifact = require("../artifacts/contracts/PharmaceuticalSupplyChain.sol/PharmaceuticalSupplyChain.json");
  fs.writeFileSync(
    path.join(abiDir, "PharmaceuticalSupplyChain.json"),
    JSON.stringify(artifact.abi, null, 2)
  );

  // Write deployment info
  const deployInfo = {
    address,
    network:   (await ethers.provider.getNetwork()).name,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(abiDir, "deployment.json"),
    JSON.stringify(deployInfo, null, 2)
  );

  // Append/update .env in frontend
  const envPath = path.join(__dirname, "../frontend/.env");
  const envLine = `REACT_APP_CONTRACT_ADDRESS=${address}\n`;
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf8");
    if (content.includes("REACT_APP_CONTRACT_ADDRESS=")) {
      content = content.replace(/REACT_APP_CONTRACT_ADDRESS=.*/g, envLine.trim());
      fs.writeFileSync(envPath, content);
    } else {
      fs.appendFileSync(envPath, envLine);
    }
  } else {
    fs.writeFileSync(envPath, envLine);
  }

  console.log("\n📁 ABI written to frontend/src/abi/PharmaceuticalSupplyChain.json");
  console.log("📝 Contract address saved to frontend/.env");
  console.log("\nNext steps:");
  console.log("  1. Add your Pinata keys to frontend/.env");
  console.log("  2. cd frontend && npm start");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
