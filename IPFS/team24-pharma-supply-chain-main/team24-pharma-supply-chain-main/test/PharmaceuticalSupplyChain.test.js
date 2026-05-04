// test/PharmaceuticalSupplyChain.test.js
// ──────────────────────────────────────────────────────────────────
// Unit tests for the PharmaceuticalSupplyChain smart contract.
// Run with:  npx hardhat test
// ──────────────────────────────────────────────────────────────────

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaceuticalSupplyChain", function () {
  let contract;
  let admin, manufacturer, distributor, pharmacy, regulator, consumer, unauthorized;

  // Fresh deployment before each test
  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy, regulator, consumer, unauthorized] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PharmaceuticalSupplyChain");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Assign roles
    await contract.assignRole(manufacturer.address, 1);
    await contract.assignRole(distributor.address,  2);
    await contract.assignRole(pharmacy.address,     3);
    await contract.assignRole(regulator.address,    4);
    await contract.assignRole(consumer.address,     5);
  });

  // ── Role management ──────────────────────────────────────────────

  describe("Role Management", function () {
    it("should set the deployer as admin", async function () {
      expect(await contract.admin()).to.equal(admin.address);
    });

    it("should correctly assign roles", async function () {
      expect(await contract.getRole(manufacturer.address)).to.equal(1);
      expect(await contract.getRole(distributor.address)).to.equal(2);
      expect(await contract.getRole(pharmacy.address)).to.equal(3);
      expect(await contract.getRole(regulator.address)).to.equal(4);
      expect(await contract.getRole(consumer.address)).to.equal(5);
    });

    it("should prevent non-admin from assigning roles", async function () {
      await expect(
        contract.connect(manufacturer).assignRole(unauthorized.address, 1)
      ).to.be.revertedWith("Only admin can call this");
    });

    it("should emit RoleAssigned event", async function () {
      await expect(contract.assignRole(unauthorized.address, 2))
        .to.emit(contract, "RoleAssigned")
        .withArgs(unauthorized.address, 2);
    });
  });

  // ── Batch registration ───────────────────────────────────────────

  describe("Batch Registration", function () {
    const batchId  = "BATCH-TEST-001";
    const drugName = "Amoxicillin 500mg";
    const mfgDate  = 1700000000;
    const expDate  = 1731536000;
    const ipfs     = "QmTestHash123";

    it("should allow manufacturer to register a batch", async function () {
      await contract.connect(manufacturer).registerBatch(batchId, drugName, mfgDate, expDate, ipfs);

      const batch = await contract.getBatch(batchId);
      expect(batch.batchId).to.equal(batchId);
      expect(batch.drugName).to.equal(drugName);
      expect(batch.currentOwner).to.equal(manufacturer.address);
      expect(batch.status).to.equal(0); // Registered
    });

    it("should prevent duplicate batch IDs", async function () {
      await contract.connect(manufacturer).registerBatch(batchId, drugName, mfgDate, expDate, ipfs);
      await expect(
        contract.connect(manufacturer).registerBatch(batchId, "Other Drug", mfgDate, expDate, ipfs)
      ).to.be.revertedWith("Batch already exists");
    });

    it("should prevent non-manufacturer from registering", async function () {
      await expect(
        contract.connect(distributor).registerBatch(batchId, drugName, mfgDate, expDate, ipfs)
      ).to.be.revertedWith("Caller does not have the required role");
    });

    it("should emit BatchRegistered event", async function () {
      await expect(
        contract.connect(manufacturer).registerBatch(batchId, drugName, mfgDate, expDate, ipfs)
      ).to.emit(contract, "BatchRegistered");
    });

    it("should increment batch count", async function () {
      expect(await contract.getBatchCount()).to.equal(0);
      await contract.connect(manufacturer).registerBatch(batchId, drugName, mfgDate, expDate, ipfs);
      expect(await contract.getBatchCount()).to.equal(1);
    });
  });

  // ── Ownership transfer ──────────────────────────────────────────

  describe("Ownership Transfer", function () {
    const batchId = "BATCH-TRANSFER-001";

    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        batchId, "TestDrug", 1700000000, 1731536000, "QmTest"
      );
    });

    it("should allow current owner to transfer", async function () {
      await contract.connect(manufacturer).transferOwnership(
        batchId, distributor.address, "Shipment note"
      );
      const batch = await contract.getBatch(batchId);
      expect(batch.currentOwner).to.equal(distributor.address);
      expect(batch.status).to.equal(1); // InTransit
    });

    it("should prevent transfer by non-owner", async function () {
      await expect(
        contract.connect(distributor).transferOwnership(batchId, pharmacy.address, "Hijack")
      ).to.be.revertedWith("Caller is not the current owner of this batch");
    });

    it("should prevent transfer to address with no role", async function () {
      await expect(
        contract.connect(manufacturer).transferOwnership(batchId, unauthorized.address, "Bad")
      ).to.be.revertedWith("Recipient must have an assigned role");
    });

    it("should record transfer in history", async function () {
      await contract.connect(manufacturer).transferOwnership(
        batchId, distributor.address, "Ship-001"
      );
      const history = await contract.getHistory(batchId);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[0].note).to.equal("Ship-001");
    });
  });

  // ── Receive shipment ─────────────────────────────────────────────

  describe("Receive Shipment", function () {
    const batchId = "BATCH-RECV-001";

    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        batchId, "TestDrug", 1700000000, 1731536000, "QmTest"
      );
      await contract.connect(manufacturer).transferOwnership(
        batchId, distributor.address, "Ship"
      );
    });

    it("should allow recipient to confirm receipt", async function () {
      await contract.connect(distributor).receiveShipment(batchId);
      const batch = await contract.getBatch(batchId);
      expect(batch.status).to.equal(2); // Received
    });

    it("should only work when batch is InTransit", async function () {
      await contract.connect(distributor).receiveShipment(batchId);
      await expect(
        contract.connect(distributor).receiveShipment(batchId)
      ).to.be.revertedWith("Batch is not in transit");
    });
  });

  // ── Verification ────────────────────────────────────────────────

  describe("Batch Verification", function () {
    const batchId = "BATCH-VERIFY-001";

    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        batchId, "TestDrug", 1700000000, 1731536000, "QmTest"
      );
      // Move batch all the way to pharmacy
      await contract.connect(manufacturer).transferOwnership(batchId, distributor.address, "S1");
      await contract.connect(distributor).receiveShipment(batchId);
      await contract.connect(distributor).transferOwnership(batchId, pharmacy.address, "S2");
      await contract.connect(pharmacy).receiveShipment(batchId);
    });

    it("should allow pharmacy to verify batch", async function () {
      await contract.connect(pharmacy).verifyBatch(batchId);
      const batch = await contract.getBatch(batchId);
      expect(batch.status).to.equal(3); // Verified
    });

    it("should prevent non-pharmacy from verifying", async function () {
      await expect(
        contract.connect(distributor).verifyBatch(batchId)
      ).to.be.revertedWith("Caller does not have the required role");
    });
  });

  // ── Flagging ─────────────────────────────────────────────────────

  describe("Batch Flagging", function () {
    const batchId = "BATCH-FLAG-001";

    beforeEach(async function () {
      await contract.connect(manufacturer).registerBatch(
        batchId, "TestDrug", 1700000000, 1731536000, "QmTest"
      );
    });

    it("should allow regulator to flag a batch", async function () {
      await contract.connect(regulator).flagBatch(batchId, "Suspicious temperature data");
      const batch = await contract.getBatch(batchId);
      expect(batch.status).to.equal(4); // Flagged
    });

    it("should allow pharmacy to flag a batch", async function () {
      // Transfer to pharmacy first
      await contract.connect(manufacturer).transferOwnership(batchId, distributor.address, "S");
      await contract.connect(distributor).receiveShipment(batchId);
      await contract.connect(distributor).transferOwnership(batchId, pharmacy.address, "S2");

      await contract.connect(pharmacy).flagBatch(batchId, "Packaging looks tampered");
      const batch = await contract.getBatch(batchId);
      expect(batch.status).to.equal(4);
    });

    it("should prevent unauthorized users from flagging", async function () {
      await expect(
        contract.connect(consumer).flagBatch(batchId, "I think it's fake")
      ).to.be.revertedWith("Only Regulator or Pharmacy can flag");
    });

    it("should emit BatchFlagged event", async function () {
      await expect(
        contract.connect(regulator).flagBatch(batchId, "Temperature issue")
      ).to.emit(contract, "BatchFlagged");
    });
  });

  // ── End-to-end flow ──────────────────────────────────────────────

  describe("Full Supply Chain Flow", function () {
    it("should complete the entire lifecycle", async function () {
      const batchId = "BATCH-E2E-001";

      // Register
      await contract.connect(manufacturer).registerBatch(
        batchId, "Amoxicillin 500mg", 1700000000, 1731536000, "QmHash"
      );

      // Manufacturer → Distributor
      await contract.connect(manufacturer).transferOwnership(
        batchId, distributor.address, "Shipment SHP-001"
      );
      await contract.connect(distributor).receiveShipment(batchId);

      // Distributor → Pharmacy
      await contract.connect(distributor).transferOwnership(
        batchId, pharmacy.address, "Delivery DEL-045"
      );
      await contract.connect(pharmacy).receiveShipment(batchId);

      // Pharmacy verifies
      await contract.connect(pharmacy).verifyBatch(batchId);

      // Check final state
      const batch = await contract.getBatch(batchId);
      expect(batch.status).to.equal(3); // Verified
      expect(batch.currentOwner).to.equal(pharmacy.address);

      // Check full history
      const history = await contract.getHistory(batchId);
      expect(history.length).to.equal(2);
      expect(history[0].note).to.equal("Shipment SHP-001");
      expect(history[1].note).to.equal("Delivery DEL-045");
    });
  });
});
