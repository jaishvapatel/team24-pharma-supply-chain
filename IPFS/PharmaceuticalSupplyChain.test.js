/**
 * PharmaceuticalSupplyChain.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hardhat + Chai tests.
 * Covers IPFS CID storage, on-chain retrieval, and document attachment.
 * Run: npx hardhat test
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { expect }        = require("chai");
const { ethers }        = require("hardhat");
const { time }          = require("@nomicfoundation/hardhat-network-helpers");

// Sample IPFS CIDs (CIDv1 format)
const META_CID     = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const TRANSFER_CID = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
const RECALL_CID   = "bafybeif2meu6qblacnjfzapt3cggibdbbbnmkbkm4iqsxn3qcktlhkqeom";

describe("PharmaceuticalSupplyChain – IPFS Storage", function () {
  let contract, owner, manufacturer, distributor, pharmacy, regulator, consumer;

  const BATCH_ID    = "BATCH-2025-001";
  const DRUG_NAME   = "Amoxicillin 500mg";
  const NOW         = Math.floor(Date.now() / 1000);
  const EXPIRY      = NOW + 60 * 60 * 24 * 365; // 1 year

  beforeEach(async function () {
    [owner, manufacturer, distributor, pharmacy, regulator, consumer] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PharmaceuticalSupplyChain");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Assign roles
    await contract.connect(owner).assignRole(manufacturer.address, 1); // Manufacturer
    await contract.connect(owner).assignRole(distributor.address,  2); // Distributor
    await contract.connect(owner).assignRole(pharmacy.address,     3); // Pharmacy
    await contract.connect(owner).assignRole(regulator.address,    4); // Regulator
    await contract.connect(owner).assignRole(consumer.address,     5); // Consumer
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Batch Registration with IPFS CID", function () {
    it("stores the metadata CID on-chain", async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );

      const [,,,,, storedCID] = await contract.getBatch(BATCH_ID);
      expect(storedCID).to.equal(META_CID);
    });

    it("emits BatchRegistered event with CID", async function () {
      await expect(
        contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID)
      ).to.emit(contract, "BatchRegistered")
       .withArgs(BATCH_ID, manufacturer.address, META_CID);
    });

    it("rejects registration without a CID", async function () {
      await expect(
        contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, "")
      ).to.be.revertedWith("IPFS CID required");
    });

    it("records the CID in history[0]", async function () {
      await contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID);
      const history = await contract.getHistory(BATCH_ID);
      expect(history[0].ipfsCID).to.equal(META_CID);
      expect(history[0].action).to.equal("REGISTERED");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Ownership Transfer with IPFS CID", function () {
    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID);
    });

    it("stores transfer doc CID in history", async function () {
      await contract.connect(manufacturer).transferOwnership(
        BATCH_ID, distributor.address, TRANSFER_CID
      );
      const history = await contract.getHistory(BATCH_ID);
      const last = history[history.length - 1];
      expect(last.ipfsCID).to.equal(TRANSFER_CID);
      expect(last.action).to.equal("TRANSFERRED");
    });

    it("emits OwnershipTransferred with CID", async function () {
      await expect(
        contract.connect(manufacturer).transferOwnership(BATCH_ID, distributor.address, TRANSFER_CID)
      ).to.emit(contract, "OwnershipTransferred")
       .withArgs(BATCH_ID, manufacturer.address, distributor.address, TRANSFER_CID);
    });

    it("allows empty CID for transfer (optional doc)", async function () {
      await expect(
        contract.connect(manufacturer).transferOwnership(BATCH_ID, distributor.address, "")
      ).to.not.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("attachDocument", function () {
    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID);
    });

    it("attaches a document and returns it", async function () {
      await contract.connect(manufacturer).attachDocument(BATCH_ID, RECALL_CID, "recall_notice");
      const [,,,, , , docCount] = await contract.getBatch(BATCH_ID);
      expect(docCount).to.equal(1n);

      const [cid, docType] = await contract.getDocument(BATCH_ID, 0);
      expect(cid).to.equal(RECALL_CID);
      expect(docType).to.equal("recall_notice");
    });

    it("emits DocumentAttached", async function () {
      await expect(
        contract.connect(manufacturer).attachDocument(BATCH_ID, RECALL_CID, "lab_report")
      ).to.emit(contract, "DocumentAttached")
       .withArgs(BATCH_ID, RECALL_CID, "lab_report");
    });

    it("allows multiple documents", async function () {
      await contract.connect(manufacturer).attachDocument(BATCH_ID, META_CID,     "coa");
      await contract.connect(manufacturer).attachDocument(BATCH_ID, RECALL_CID,   "recall");
      await contract.connect(distributor).attachDocument(BATCH_ID, TRANSFER_CID, "shipping");

      const [,,,,,, count] = await contract.getBatch(BATCH_ID);
      expect(count).to.equal(3n);
    });

    it("rejects Consumer from attaching documents", async function () {
      await expect(
        contract.connect(consumer).attachDocument(BATCH_ID, RECALL_CID, "recall")
      ).to.be.revertedWith("Not authorized");
    });

    it("rejects empty CID", async function () {
      await expect(
        contract.connect(manufacturer).attachDocument(BATCH_ID, "", "doc")
      ).to.be.revertedWith("Empty CID");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Full supply chain journey with IPFS", function () {
    it("tracks CIDs across the entire lifecycle", async function () {
      // 1. Register
      await contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID);

      // 2. Transfer Manufacturer → Distributor
      await contract.connect(manufacturer).transferOwnership(BATCH_ID, distributor.address, TRANSFER_CID);

      // 3. Transfer Distributor → Pharmacy
      await contract.connect(distributor).transferOwnership(BATCH_ID, pharmacy.address, RECALL_CID);

      // 4. Pharmacy verifies
      await contract.connect(pharmacy).verifyBatch(BATCH_ID);

      // 5. Attach quality doc
      await contract.connect(pharmacy).attachDocument(BATCH_ID, META_CID, "quality_check");

      // Verify history
      const history = await contract.getHistory(BATCH_ID);
      expect(history).to.have.length(4); // registered, transfer×2, verified

      expect(history[0].action).to.equal("REGISTERED");
      expect(history[0].ipfsCID).to.equal(META_CID);

      expect(history[1].action).to.equal("TRANSFERRED");
      expect(history[1].ipfsCID).to.equal(TRANSFER_CID);

      expect(history[2].action).to.equal("TRANSFERRED");
      expect(history[2].ipfsCID).to.equal(RECALL_CID);

      expect(history[3].action).to.equal("VERIFIED");

      // Verify document attachment
      const [,,,,,, docCount] = await contract.getBatch(BATCH_ID);
      expect(docCount).to.equal(1n);

      // Batch should be verified
      const [,,,, verified] = await contract.getBatch(BATCH_ID);
      expect(verified).to.be.true;
    });
  });
});
