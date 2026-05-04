// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PharmaceuticalSupplyChain
 * @dev Team 24 - CSE 540
 * Extended with IPFS off-chain document storage.
 * Only IPFS CIDs are stored on-chain; full document data lives on IPFS.
 */
contract PharmaceuticalSupplyChain {

    // ─────────────────────────── Roles ───────────────────────────────────────

    enum Role { None, Manufacturer, Distributor, Pharmacy, Regulator, Consumer }

    mapping(address => Role) public roles;
    address public owner;

    // ─────────────────────────── Batch ───────────────────────────────────────

    struct BatchDocument {
        string  ipfsCID;        // IPFS Content Identifier (CIDv1 preferred)
        string  docType;        // e.g. "lab_report", "certificate", "invoice"
        uint256 uploadedAt;
        address uploadedBy;
    }

    struct Batch {
        string   batchId;
        string   drugName;
        uint256  manufactureDate;
        uint256  expiryDate;
        address  currentOwner;
        bool     isVerified;
        bool     exists;

        // IPFS – primary metadata CID (manufacturing record, COA, etc.)
        string   metadataCID;

        // Additional documents attached over the batch lifetime
        BatchDocument[] documents;
    }

    // ─────────────────────────── History ─────────────────────────────────────

    struct HistoryEntry {
        address from;
        address to;
        uint256 timestamp;
        string  action;
        string  ipfsCID;   // optional: shipping doc, transfer note, etc.
    }

    // ─────────────────────────── Storage ─────────────────────────────────────

    mapping(string => Batch)           private batches;
    mapping(string => HistoryEntry[])  private batchHistory;

    // ─────────────────────────── Events ──────────────────────────────────────

    event RoleAssigned(address indexed account, Role role);
    event BatchRegistered(string indexed batchId, address indexed manufacturer, string metadataCID);
    event OwnershipTransferred(string indexed batchId, address indexed from, address indexed to, string ipfsCID);
    event BatchVerified(string indexed batchId, address indexed verifier);
    event DocumentAttached(string indexed batchId, string ipfsCID, string docType);

    // ─────────────────────────── Modifiers ───────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Unauthorized role");
        _;
    }

    modifier onlyRoles(Role r1, Role r2) {
        require(roles[msg.sender] == r1 || roles[msg.sender] == r2, "Unauthorized role");
        _;
    }

    modifier batchExists(string memory batchId) {
        require(batches[batchId].exists, "Batch not found");
        _;
    }

    // ─────────────────────────── Constructor ─────────────────────────────────

    constructor() {
        owner = msg.sender;
        roles[msg.sender] = Role.Regulator;
    }

    // ─────────────────────────── Role Management ─────────────────────────────

    function assignRole(address account, Role role) external onlyOwner {
        roles[account] = role;
        emit RoleAssigned(account, role);
    }

    // ─────────────────────────── Batch Registration ──────────────────────────

    /**
     * @notice Register a new drug batch.
     * @param batchId        Unique batch identifier
     * @param drugName       Drug name / product name
     * @param manufactureDate Unix timestamp
     * @param expiryDate     Unix timestamp
     * @param metadataCID    IPFS CID of the batch metadata JSON (COA, formulation, etc.)
     */
    function registerBatch(
        string memory batchId,
        string memory drugName,
        uint256 manufactureDate,
        uint256 expiryDate,
        string memory metadataCID
    ) external onlyRole(Role.Manufacturer) {
        require(!batches[batchId].exists, "Batch already registered");
        require(bytes(metadataCID).length > 0, "IPFS CID required");

        Batch storage b = batches[batchId];
        b.batchId        = batchId;
        b.drugName       = drugName;
        b.manufactureDate = manufactureDate;
        b.expiryDate     = expiryDate;
        b.currentOwner   = msg.sender;
        b.isVerified     = false;
        b.exists         = true;
        b.metadataCID    = metadataCID;

        batchHistory[batchId].push(HistoryEntry({
            from:      address(0),
            to:        msg.sender,
            timestamp: block.timestamp,
            action:    "REGISTERED",
            ipfsCID:   metadataCID
        }));

        emit BatchRegistered(batchId, msg.sender, metadataCID);
    }

    // ─────────────────────────── Ownership Transfer ──────────────────────────

    /**
     * @notice Transfer batch to next stakeholder.
     * @param batchId        Batch identifier
     * @param newOwner       Address of the recipient (must have Distributor/Pharmacy role)
     * @param transferDocCID IPFS CID of the transfer document (shipping manifest, invoice, etc.)
     */
    function transferOwnership(
        string memory batchId,
        address newOwner,
        string memory transferDocCID
    ) external batchExists(batchId) {
        Batch storage b = batches[batchId];
        require(b.currentOwner == msg.sender, "Not current owner");
        require(
            roles[newOwner] == Role.Distributor ||
            roles[newOwner] == Role.Pharmacy    ||
            roles[newOwner] == Role.Regulator,
            "Recipient has invalid role"
        );

        address prevOwner = b.currentOwner;
        b.currentOwner   = newOwner;

        batchHistory[batchId].push(HistoryEntry({
            from:      prevOwner,
            to:        newOwner,
            timestamp: block.timestamp,
            action:    "TRANSFERRED",
            ipfsCID:   transferDocCID
        }));

        emit OwnershipTransferred(batchId, prevOwner, newOwner, transferDocCID);
    }

    // ─────────────────────────── Verification ────────────────────────────────

    /**
     * @notice Pharmacy or Regulator verifies the batch.
     */
    function verifyBatch(string memory batchId)
        external
        batchExists(batchId)
        onlyRoles(Role.Pharmacy, Role.Regulator)
    {
        Batch storage b = batches[batchId];
        require(!b.isVerified, "Already verified");
        b.isVerified = true;

        batchHistory[batchId].push(HistoryEntry({
            from:      msg.sender,
            to:        msg.sender,
            timestamp: block.timestamp,
            action:    "VERIFIED",
            ipfsCID:   ""
        }));

        emit BatchVerified(batchId, msg.sender);
    }

    // ─────────────────────────── Document Attachment ─────────────────────────

    /**
     * @notice Attach an additional IPFS document to a batch.
     *         E.g., recall notice, temperature log, regulatory submission.
     * @param batchId  Target batch
     * @param ipfsCID  IPFS Content Identifier of the document
     * @param docType  Human-readable document type tag
     */
    function attachDocument(
        string memory batchId,
        string memory ipfsCID,
        string memory docType
    ) external batchExists(batchId) {
        require(
            roles[msg.sender] != Role.None && roles[msg.sender] != Role.Consumer,
            "Not authorized"
        );
        require(bytes(ipfsCID).length > 0, "Empty CID");

        batches[batchId].documents.push(BatchDocument({
            ipfsCID:    ipfsCID,
            docType:    docType,
            uploadedAt: block.timestamp,
            uploadedBy: msg.sender
        }));

        emit DocumentAttached(batchId, ipfsCID, docType);
    }

    // ─────────────────────────── Getters ─────────────────────────────────────

    function getBatch(string memory batchId)
        external
        view
        batchExists(batchId)
        returns (
            string memory drugName,
            uint256 manufactureDate,
            uint256 expiryDate,
            address currentOwner,
            bool isVerified,
            string memory metadataCID,
            uint256 documentCount
        )
    {
        Batch storage b = batches[batchId];
        return (
            b.drugName,
            b.manufactureDate,
            b.expiryDate,
            b.currentOwner,
            b.isVerified,
            b.metadataCID,
            b.documents.length
        );
    }

    function getDocument(string memory batchId, uint256 index)
        external
        view
        batchExists(batchId)
        returns (string memory ipfsCID, string memory docType, uint256 uploadedAt, address uploadedBy)
    {
        BatchDocument storage d = batches[batchId].documents[index];
        return (d.ipfsCID, d.docType, d.uploadedAt, d.uploadedBy);
    }

    function getHistory(string memory batchId)
        external
        view
        batchExists(batchId)
        returns (HistoryEntry[] memory)
    {
        return batchHistory[batchId];
    }

    function getRole(address account) external view returns (Role) {
        return roles[account];
    }
}
