/**
 * PharmaceuticalSupplyChain.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hardhat + Chai tests for PharmaceuticalSupplyChain v2.
 * Covers core supply chain functions and IPFS off-chain storage.
 * Run: npx hardhat test
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Sample IPFS CIDs (CIDv1 format)
const META_CID     = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const TRANSFER_CID = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
const RECALL_CID   = "bafybeif2meu6qblacnjfzapt3cggibdbbbnmkbkm4iqsxn3qcktlhkqeom";

describe("PharmaceuticalSupplyChain – IPFS Storage", function () {
  let contract, owner, manufacturer, distributor, pharmacy, regulator, consumer;

  const BATCH_ID  = "BATCH-2025-001";
  const DRUG_NAME = "Amoxicillin 500mg";
  const NOW       = Math.floor(Date.now() / 1000);
  const EXPIRY    = NOW + 60 * 60 * 24 * 365; // 1 year

  beforeEach(async function () {
    [owner, manufacturer, distributor, pharmacy, regulator, consumer] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PharmaceuticalSupplyChain");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Assign roles (enum: 1=Manufacturer, 2=Distributor, 3=Pharmacy, 4=Regulator, 5=Consumer)
    await contract.connect(owner).assignRole(manufacturer.address, 1);
    await contract.connect(owner).assignRole(distributor.address,  2);
    await contract.connect(owner).assignRole(pharmacy.address,     3);
    await contract.connect(owner).assignRole(regulator.address,    4);
    await contract.connect(owner).assignRole(consumer.address,     5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Batch Registration with IPFS CID", function () {

    it("stores the metadata CID on-chain in DrugBatch.ipfsHash", async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
      // DrugBatch fields: batchId, drugName, currentOwner, status, manufactureDate, expiryDate, ipfsHash
      const batch = await contract.getBatch(BATCH_ID);
      expect(batch.ipfsHash).to.equal(META_CID);
    });

    it("emits BatchRegistered event", async function () {
      // event BatchRegistered(string batchId, string drugName, address manufacturer, uint256 timestamp)
      await expect(
        contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID)
      ).to.emit(contract, "BatchRegistered")
       .withArgs(BATCH_ID, DRUG_NAME, manufacturer.address, await latestTimestamp());
    });

    it("seeds ipfsHistory[0] with the genesis CID on registration", async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
      const history = await contract.getIPFSHistory(BATCH_ID);
      expect(history).to.have.length(1);
      expect(history[0].ipfsHash).to.equal(META_CID);
      expect(history[0].uploadedBy).to.equal(manufacturer.address);
      expect(history[0].docType).to.equal("BatchRegistration");
    });

    it("emits IPFSDocumentLinked on registration when CID is provided", async function () {
      await expect(
        contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID)
      ).to.emit(contract, "IPFSDocumentLinked")
       .withArgs(BATCH_ID, META_CID, manufacturer.address, "BatchRegistration", await latestTimestamp());
    });

    it("does NOT seed ipfsHistory when no CID is provided at registration", async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, ""
      );
      const history = await contract.getIPFSHistory(BATCH_ID);
      expect(history).to.have.length(0);
    });

    it("rejects duplicate batch IDs", async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
      await expect(
        contract.connect(manufacturer).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID)
      ).to.be.revertedWith("Batch already exists");
    });

    it("rejects registration from a non-Manufacturer", async function () {
      await expect(
        contract.connect(distributor).registerBatch(BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID)
      ).to.be.revertedWith("Caller does not have the required role");
    });

    it("increments getBatchCount after registration", async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
      expect(await contract.getBatchCount()).to.equal(1n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Ownership Transfer", function () {
    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
    });

    it("updates currentOwner and status to InTransit", async function () {
      await contract.connect(manufacturer).transferOwnership(
        BATCH_ID, distributor.address, TRANSFER_CID
      );
      const batch = await contract.getBatch(BATCH_ID);
      expect(batch.currentOwner).to.equal(distributor.address);
      expect(batch.status).to.equal(1n); // BatchStatus.InTransit = 1
    });

    it("records the transfer in transferHistory", async function () {
      await contract.connect(manufacturer).transferOwnership(
        BATCH_ID, distributor.address, TRANSFER_CID
      );
      // getHistory returns TransferRecord[]: { from, to, timestamp, note }
      const history = await contract.getHistory(BATCH_ID);
      expect(history).to.have.length(1);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[0].note).to.equal(TRANSFER_CID);
    });

    it("emits OwnershipTransferred", async function () {
      // event OwnershipTransferred(string batchId, address from, address to, uint256 timestamp)
      await expect(
        contract.connect(manufacturer).transferOwnership(
          BATCH_ID, distributor.address, TRANSFER_CID
        )
      ).to.emit(contract, "OwnershipTransferred")
       .withArgs(BATCH_ID, manufacturer.address, distributor.address, await latestTimestamp());
    });

    it("allows an empty note on transfer", async function () {
      await expect(
        contract.connect(manufacturer).transferOwnership(BATCH_ID, distributor.address, "")
      ).to.not.be.reverted;
    });

    it("rejects transfer from non-owner", async function () {
      await expect(
        contract.connect(distributor).transferOwnership(BATCH_ID, pharmacy.address, "")
      ).to.be.revertedWith("Caller is not the current owner of this batch");
    });

    it("rejects transfer to an address with no role", async function () {
      const [,,,,,, stranger] = await ethers.getSigners();
      await expect(
        contract.connect(manufacturer).transferOwnership(BATCH_ID, stranger.address, "")
      ).to.be.revertedWith("Recipient must have an assigned role");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("receiveShipment", function () {
    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
      await contract.connect(manufacturer).transferOwnership(
        BATCH_ID, distributor.address, ""
      );
    });

    it("sets status to Received", async function () {
      await contract.connect(distributor).receiveShipment(BATCH_ID);
      const batch = await contract.getBatch(BATCH_ID);
      expect(batch.status).to.equal(2n); // BatchStatus.Received = 2
    });

    it("emits BatchReceived", async function () {
      await expect(
        contract.connect(distributor).receiveShipment(BATCH_ID)
      ).to.emit(contract, "BatchReceived")
       .withArgs(BATCH_ID, distributor.address, await latestTimestamp());
    });

    it("rejects receiveShipment if not InTransit", async function () {
      await contract.connect(distributor).receiveShipment(BATCH_ID);
      await expect(
        contract.connect(distributor).receiveShipment(BATCH_ID)
      ).to.be.revertedWith("Batch is not in transit");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("linkIPFSDocument", function () {
    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );
    });

    it("appends a new IPFSRecord to ipfsHistory", async function () {
      await contract.connect(manufacturer).linkIPFSDocument(
        BATCH_ID, RECALL_CID, "LabReport"
      );
      const history = await contract.getIPFSHistory(BATCH_ID);
      // index 0 = genesis from registerBatch, index 1 = new doc
      expect(history).to.have.length(2);
      expect(history[1].ipfsHash).to.equal(RECALL_CID);
      expect(history[1].uploadedBy).to.equal(manufacturer.address);
      expect(history[1].docType).to.equal("LabReport");
    });

    it("updates DrugBatch.ipfsHash to the latest CID", async function () {
      await contract.connect(manufacturer).linkIPFSDocument(
        BATCH_ID, RECALL_CID, "LabReport"
      );
      const batch = await contract.getBatch(BATCH_ID);
      expect(batch.ipfsHash).to.equal(RECALL_CID);
    });

    it("emits IPFSDocumentLinked", async function () {
      await expect(
        contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, RECALL_CID, "LabReport")
      ).to.emit(contract, "IPFSDocumentLinked")
       .withArgs(BATCH_ID, RECALL_CID, manufacturer.address, "LabReport", await latestTimestamp());
    });

    it("allows a Regulator to attach a document regardless of ownership", async function () {
      await expect(
        contract.connect(regulator).linkIPFSDocument(BATCH_ID, RECALL_CID, "AuditReport")
      ).to.not.be.reverted;

      const history = await contract.getIPFSHistory(BATCH_ID);
      expect(history[history.length - 1].uploadedBy).to.equal(regulator.address);
    });

    it("allows multiple documents to be linked", async function () {
      await contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, META_CID,     "COA");
      await contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, RECALL_CID,   "Recall");
      await contract.connect(regulator).linkIPFSDocument(BATCH_ID,   TRANSFER_CID, "AuditReport");

      const history = await contract.getIPFSHistory(BATCH_ID);
      // 1 genesis + 3 linked = 4
      expect(history).to.have.length(4);
    });

    it("preserves older CIDs — history is never overwritten", async function () {
      await contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, RECALL_CID,   "LabReport");
      await contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, TRANSFER_CID, "COA");

      const history = await contract.getIPFSHistory(BATCH_ID);
      expect(history[0].ipfsHash).to.equal(META_CID);     // genesis
      expect(history[1].ipfsHash).to.equal(RECALL_CID);   // first link
      expect(history[2].ipfsHash).to.equal(TRANSFER_CID); // second link
    });

    it("rejects a non-owner / non-Regulator from linking documents", async function () {
      await expect(
        contract.connect(consumer).linkIPFSDocument(BATCH_ID, RECALL_CID, "doc")
      ).to.be.revertedWith("Only current owner or Regulator can link documents");
    });

    it("rejects an empty IPFS hash", async function () {
      await expect(
        contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, "", "LabReport")
      ).to.be.revertedWith("IPFS hash cannot be empty");
    });

    it("rejects an empty document type", async function () {
      await expect(
        contract.connect(manufacturer).linkIPFSDocument(BATCH_ID, RECALL_CID, "")
      ).to.be.revertedWith("Document type cannot be empty");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Full supply chain journey with IPFS", function () {
    it("tracks CIDs across the entire lifecycle", async function () {
      // 1. Manufacturer registers batch
      await contract.connect(manufacturer).registerBatch(
        BATCH_ID, DRUG_NAME, NOW, EXPIRY, META_CID
      );

      // 2. Manufacturer → Distributor (CID passed as the transfer note)
      await contract.connect(manufacturer).transferOwnership(
        BATCH_ID, distributor.address, TRANSFER_CID
      );

      // 3. Distributor confirms receipt
      await contract.connect(distributor).receiveShipment(BATCH_ID);

      // 4. Distributor → Pharmacy
      await contract.connect(distributor).transferOwnership(
        BATCH_ID, pharmacy.address, RECALL_CID
      );

      // 5. Pharmacy receives and verifies
      await contract.connect(pharmacy).receiveShipment(BATCH_ID);
      await contract.connect(pharmacy).verifyBatch(BATCH_ID);

      // 6. Pharmacy attaches a quality-check document
      await contract.connect(pharmacy).linkIPFSDocument(
        BATCH_ID, RECALL_CID, "QualityCheck"
      );

      // ── Assertions ──────────────────────────────────────────────────

      // Batch should be Verified (status = 3)
      const batch = await contract.getBatch(BATCH_ID);
      expect(batch.status).to.equal(3n);
      expect(batch.currentOwner).to.equal(pharmacy.address);

      // Transfer history: 2 transfers recorded
      const transfers = await contract.getHistory(BATCH_ID);
      expect(transfers).to.have.length(2);
      expect(transfers[0].from).to.equal(manufacturer.address);
      expect(transfers[0].to).to.equal(distributor.address);
      expect(transfers[1].from).to.equal(distributor.address);
      expect(transfers[1].to).to.equal(pharmacy.address);

      // IPFS history: genesis + 1 linked doc = 2
      const ipfsHistory = await contract.getIPFSHistory(BATCH_ID);
      expect(ipfsHistory).to.have.length(2);
      expect(ipfsHistory[0].ipfsHash).to.equal(META_CID);
      expect(ipfsHistory[0].docType).to.equal("BatchRegistration");
      expect(ipfsHistory[1].ipfsHash).to.equal(RECALL_CID);
      expect(ipfsHistory[1].docType).to.equal("QualityCheck");

      // Latest CID on the batch struct should be the quality-check doc
      expect(batch.ipfsHash).to.equal(RECALL_CID);
    });
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────
// Returns the latest block timestamp. Used in event argument matching where
// the exact timestamp isn't known ahead of time. Tests that need precise
// matching should call this *before* the transaction so the value is stable.
async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block.timestamp + 1); // +1 because the tx mines a new block
}
