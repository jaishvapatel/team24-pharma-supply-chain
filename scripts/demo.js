// scripts/demo.js
// ──────────────────────────────────────────────────────────────────
// Full end-to-end demo of the Pharmaceutical Supply Chain system.
// Run with:  npx hardhat run scripts/demo.js
//
// This script simulates the entire lifecycle:
//   1. Deploy the contract
//   2. Assign roles to five different wallets
//   3. Manufacturer registers a drug batch
//   4. Manufacturer transfers batch to Distributor
//   5. Distributor confirms receipt
//   6. Distributor transfers batch to Pharmacy
//   7. Pharmacy confirms receipt
//   8. Pharmacy verifies the batch as authentic
//   9. Query the full chain-of-custody history
//  10. (Bonus) Regulator flags a second batch
// ──────────────────────────────────────────────────────────────────

const hre = require("hardhat");

// Helper: readable role names
const ROLE_NAMES = ["None", "Manufacturer", "Distributor", "Pharmacy", "Regulator", "Consumer"];

// Helper: readable status names
const STATUS_NAMES = ["Registered", "InTransit", "Received", "Verified", "Flagged"];

function separator(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

async function main() {
  // Get test accounts from Hardhat's local node
  const [admin, manufacturer, distributor, pharmacy, regulator, consumer] =
    await hre.ethers.getSigners();

  // ── Step 1: Deploy ──────────────────────────────────────────────
  separator("STEP 1 — Deploy Contract");

  const Factory = await hre.ethers.getContractFactory("PharmaceuticalSupplyChain");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log(`Contract deployed to: ${addr}`);
  console.log(`Admin address:        ${admin.address}`);

  // ── Step 2: Assign roles ────────────────────────────────────────
  separator("STEP 2 — Assign Roles");

  await contract.assignRole(manufacturer.address, 1); // Manufacturer
  await contract.assignRole(distributor.address,  2); // Distributor
  await contract.assignRole(pharmacy.address,     3); // Pharmacy
  await contract.assignRole(regulator.address,    4); // Regulator
  await contract.assignRole(consumer.address,     5); // Consumer

  console.log(`Manufacturer: ${manufacturer.address}  →  ${ROLE_NAMES[1]}`);
  console.log(`Distributor:  ${distributor.address}  →  ${ROLE_NAMES[2]}`);
  console.log(`Pharmacy:     ${pharmacy.address}  →  ${ROLE_NAMES[3]}`);
  console.log(`Regulator:    ${regulator.address}  →  ${ROLE_NAMES[4]}`);
  console.log(`Consumer:     ${consumer.address}  →  ${ROLE_NAMES[5]}`);

  // ── Step 3: Register a drug batch ───────────────────────────────
  separator("STEP 3 — Manufacturer Registers Drug Batch");

  const batchId   = "BATCH-2026-001";
  const drugName  = "Amoxicillin 500mg";
  const mfgDate   = Math.floor(Date.now() / 1000);           // now
  const expDate   = mfgDate + (365 * 24 * 60 * 60);          // 1 year from now
  const ipfsHash  = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"; // example CID

  const mfgContract = contract.connect(manufacturer);
  await mfgContract.registerBatch(batchId, drugName, mfgDate, expDate, ipfsHash);

  let batch = await contract.getBatch(batchId);
  console.log(`Batch ID:       ${batch.batchId}`);
  console.log(`Drug Name:      ${batch.drugName}`);
  console.log(`Current Owner:  ${batch.currentOwner} (Manufacturer)`);
  console.log(`Status:         ${STATUS_NAMES[Number(batch.status)]}`);
  console.log(`IPFS Hash:      ${batch.ipfsHash}`);

  // ── Step 4: Transfer to Distributor ─────────────────────────────
  separator("STEP 4 — Manufacturer Transfers to Distributor");

  await mfgContract.transferOwnership(batchId, distributor.address, "Shipment #SHP-001 via FedEx");

  batch = await contract.getBatch(batchId);
  console.log(`Current Owner:  ${batch.currentOwner} (Distributor)`);
  console.log(`Status:         ${STATUS_NAMES[Number(batch.status)]}`);

  // ── Step 5: Distributor confirms receipt ────────────────────────
  separator("STEP 5 — Distributor Confirms Receipt");

  const distContract = contract.connect(distributor);
  await distContract.receiveShipment(batchId);

  batch = await contract.getBatch(batchId);
  console.log(`Status:         ${STATUS_NAMES[Number(batch.status)]}`);

  // ── Step 6: Distributor transfers to Pharmacy ───────────────────
  separator("STEP 6 — Distributor Transfers to Pharmacy");

  await distContract.transferOwnership(batchId, pharmacy.address, "Local delivery #DEL-045");

  batch = await contract.getBatch(batchId);
  console.log(`Current Owner:  ${batch.currentOwner} (Pharmacy)`);
  console.log(`Status:         ${STATUS_NAMES[Number(batch.status)]}`);

  // ── Step 7: Pharmacy confirms receipt ───────────────────────────
  separator("STEP 7 — Pharmacy Confirms Receipt");

  const pharmContract = contract.connect(pharmacy);
  await pharmContract.receiveShipment(batchId);

  batch = await contract.getBatch(batchId);
  console.log(`Status:         ${STATUS_NAMES[Number(batch.status)]}`);

  // ── Step 8: Pharmacy verifies the batch ─────────────────────────
  separator("STEP 8 — Pharmacy Verifies Batch Authenticity");

  await pharmContract.verifyBatch(batchId);

  batch = await contract.getBatch(batchId);
  console.log(`Status:         ${STATUS_NAMES[Number(batch.status)]}`);
  console.log(`✓ Batch verified as authentic!`);

  // ── Step 9: Full chain-of-custody history ───────────────────────
  separator("STEP 9 — Full Chain-of-Custody Audit Trail");

  const history = await contract.getHistory(batchId);
  console.log(`Total transfers: ${history.length}\n`);

  history.forEach((record, i) => {
    const date = new Date(Number(record.timestamp) * 1000).toISOString();
    console.log(`Transfer ${i + 1}:`);
    console.log(`  From: ${record.from}`);
    console.log(`  To:   ${record.to}`);
    console.log(`  Date: ${date}`);
    console.log(`  Note: ${record.note}`);
    console.log();
  });

  // ── Step 10 (Bonus): Regulator flags a suspicious batch ────────
  separator("STEP 10 — Regulator Flags a Suspicious Batch");

  // Register a second batch for flagging demo
  const batchId2 = "BATCH-2026-002";
  await mfgContract.registerBatch(batchId2, "Ibuprofen 200mg", mfgDate, expDate, "QmFakeCID123");

  // Transfer to distributor so regulator can inspect
  await mfgContract.transferOwnership(batchId2, distributor.address, "Shipment #SHP-002");

  // Regulator flags it
  const regContract = contract.connect(regulator);
  await regContract.flagBatch(batchId2, "Temperature anomaly detected during transit — requires inspection");

  const batch2 = await contract.getBatch(batchId2);
  console.log(`Batch ID:       ${batch2.batchId}`);
  console.log(`Drug Name:      ${batch2.drugName}`);
  console.log(`Status:         ${STATUS_NAMES[Number(batch2.status)]}`);
  console.log(`⚠ Batch flagged for investigation!`);

  // ── Summary ─────────────────────────────────────────────────────
  separator("DEMO COMPLETE");
  console.log(`Total batches registered: ${await contract.getBatchCount()}`);
  console.log(`Batch 1 (${batchId}): ${STATUS_NAMES[Number((await contract.getBatch(batchId)).status)]}`);
  console.log(`Batch 2 (${batchId2}): ${STATUS_NAMES[Number((await contract.getBatch(batchId2)).status)]}`);
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
