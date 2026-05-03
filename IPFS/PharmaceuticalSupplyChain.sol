// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PharmaceuticalSupplyChain
 * @dev Tracks pharmaceutical drug batches from manufacturer to consumer.
 *      Uses role-based access control to restrict actions to authorized
 *      supply chain participants. Each batch maintains an immutable
 *      transfer history for full provenance auditing.
 *
 *      Team 24 | CSE 540 | Spring B 2026
 */
contract PharmaceuticalSupplyChain {

    // ── Role definitions ─────────────────────────────────────────────
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Pharmacy,
        Regulator,
        Consumer
    }

    // ── Batch lifecycle states ───────────────────────────────────────
    enum BatchStatus {
        Registered,
        InTransit,
        Received,
        Verified,
        Flagged
    }

    // ── Data structures ──────────────────────────────────────────────

    struct DrugBatch {
        string  batchId;
        string  drugName;
        address currentOwner;
        BatchStatus status;
        uint256 manufactureDate;
        uint256 expiryDate;
        string  ipfsHash;         // IPFS CID pointing to supporting documents (latest)
    }

    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
        string  note;
    }

    // Records a single IPFS document linked to a batch.
    // Appended to ipfsHistory on every linkIPFSDocument() call so
    // no CID is ever overwritten — full document provenance is preserved.
    struct IPFSRecord {
        string  ipfsHash;    // IPFS Content Identifier (CIDv0 or CIDv1)
        address uploadedBy;  // Address that linked this document
        uint256 timestamp;   // Block timestamp of the link
        string  docType;     // e.g. "BatchCertificate", "LabReport", "COA", "AuditReport"
    }

    // ── State variables ──────────────────────────────────────────────

    address public admin;

    mapping(address => Role)             public roles;
    mapping(string  => DrugBatch)        public batches;
    mapping(string  => TransferRecord[]) public transferHistory;
    mapping(string  => IPFSRecord[])     public ipfsHistory;     // batchId → append-only IPFS document history

    string[] public batchIds;

    // ── Events ───────────────────────────────────────────────────────

    event BatchRegistered(string batchId, string drugName, address manufacturer, uint256 timestamp);
    event OwnershipTransferred(string batchId, address from, address to, uint256 timestamp);
    event BatchReceived(string batchId, address receiver, uint256 timestamp);
    event BatchVerified(string batchId, address verifiedBy, uint256 timestamp);
    event BatchFlagged(string batchId, address flaggedBy, string reason, uint256 timestamp);
    event RoleAssigned(address account, Role role);

    // Emitted whenever a new IPFS document is linked to a batch
    event IPFSDocumentLinked(
        string  indexed batchId,
        string  ipfsHash,
        address indexed uploadedBy,
        string  docType,
        uint256 timestamp
    );

    // ── Access-control modifiers ─────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Caller does not have the required role");
        _;
    }

    modifier onlyCurrentOwner(string memory _batchId) {
        require(
            batches[_batchId].currentOwner == msg.sender,
            "Caller is not the current owner of this batch"
        );
        _;
    }

    modifier batchExists(string memory _batchId) {
        require(
            bytes(batches[_batchId].batchId).length > 0,
            "Batch does not exist"
        );
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
    }

    // ── Role management ──────────────────────────────────────────────

    function assignRole(address _account, Role _role) external onlyAdmin {
        roles[_account] = _role;
        emit RoleAssigned(_account, _role);
    }

    function getRole(address _account) external view returns (Role) {
        return roles[_account];
    }

    // ── Batch registration ───────────────────────────────────────────

    function registerBatch(
        string memory _batchId,
        string memory _drugName,
        uint256 _manufactureDate,
        uint256 _expiryDate,
        string memory _ipfsHash
    ) external onlyRole(Role.Manufacturer) {
        require(bytes(batches[_batchId].batchId).length == 0, "Batch already exists");

        batches[_batchId] = DrugBatch({
            batchId:         _batchId,
            drugName:        _drugName,
            currentOwner:    msg.sender,
            status:          BatchStatus.Registered,
            manufactureDate: _manufactureDate,
            expiryDate:      _expiryDate,
            ipfsHash:        _ipfsHash
        });

        // Seed ipfsHistory with the genesis document if one was provided
        if (bytes(_ipfsHash).length > 0) {
            ipfsHistory[_batchId].push(IPFSRecord({
                ipfsHash:   _ipfsHash,
                uploadedBy: msg.sender,
                timestamp:  block.timestamp,
                docType:    "BatchRegistration"
            }));
            emit IPFSDocumentLinked(_batchId, _ipfsHash, msg.sender, "BatchRegistration", block.timestamp);
        }

        batchIds.push(_batchId);
        emit BatchRegistered(_batchId, _drugName, msg.sender, block.timestamp);
    }

    // ── Ownership transfer ───────────────────────────────────────────

    function transferOwnership(
        string memory _batchId,
        address _to,
        string memory _note
    ) external batchExists(_batchId) onlyCurrentOwner(_batchId) {
        require(_to != address(0), "Cannot transfer to zero address");
        require(roles[_to] != Role.None, "Recipient must have an assigned role");

        address previousOwner = batches[_batchId].currentOwner;
        batches[_batchId].currentOwner = _to;
        batches[_batchId].status = BatchStatus.InTransit;

        transferHistory[_batchId].push(TransferRecord({
            from:      previousOwner,
            to:        _to,
            timestamp: block.timestamp,
            note:      _note
        }));

        emit OwnershipTransferred(_batchId, previousOwner, _to, block.timestamp);
    }

    // ── Receive shipment ─────────────────────────────────────────────

    function receiveShipment(string memory _batchId)
        external
        batchExists(_batchId)
        onlyCurrentOwner(_batchId)
    {
        require(
            batches[_batchId].status == BatchStatus.InTransit,
            "Batch is not in transit"
        );
        batches[_batchId].status = BatchStatus.Received;
        emit BatchReceived(_batchId, msg.sender, block.timestamp);
    }

    // ── Verification ─────────────────────────────────────────────────

    function verifyBatch(string memory _batchId)
        external
        batchExists(_batchId)
        onlyRole(Role.Pharmacy)
    {
        batches[_batchId].status = BatchStatus.Verified;
        emit BatchVerified(_batchId, msg.sender, block.timestamp);
    }

    // ── Flagging ─────────────────────────────────────────────────────

    function flagBatch(string memory _batchId, string memory _reason)
        external
        batchExists(_batchId)
    {
        require(
            roles[msg.sender] == Role.Regulator ||
            roles[msg.sender] == Role.Pharmacy,
            "Only Regulator or Pharmacy can flag"
        );
        batches[_batchId].status = BatchStatus.Flagged;
        emit BatchFlagged(_batchId, msg.sender, _reason, block.timestamp);
    }

    // ── Read functions ───────────────────────────────────────────────

    function getBatch(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (DrugBatch memory)
    {
        return batches[_batchId];
    }

    function getHistory(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (TransferRecord[] memory)
    {
        return transferHistory[_batchId];
    }

    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }

    function getBatchIdByIndex(uint256 _index) external view returns (string memory) {
        require(_index < batchIds.length, "Index out of bounds");
        return batchIds[_index];
    }

    // ── IPFS off-chain storage ───────────────────────────────────────

    /**
     * @notice Link a new IPFS document (CID) to an existing batch.
     *         The CID is appended to an immutable ipfsHistory array so
     *         no previous hash can ever be silently overwritten.
     *         DrugBatch.ipfsHash is also updated to the latest CID so
     *         callers of getBatch() always see the most recent document.
     *
     *         WHO CAN CALL:
     *           - The current owner of the batch (any role), to attach
     *             documents relevant to their custody stage.
     *           - A Regulator, who may attach audit or lab reports at
     *             any stage regardless of current ownership.
     *
     * @param _batchId  ID of the batch to attach the document to.
     * @param _ipfsHash IPFS Content Identifier of the off-chain document.
     * @param _docType  Human-readable label, e.g. "LabReport", "COA",
     *                  "ShippingManifest", "AuditReport".
     */
    function linkIPFSDocument(
        string memory _batchId,
        string memory _ipfsHash,
        string memory _docType
    ) external batchExists(_batchId) {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(_docType).length  > 0, "Document type cannot be empty");
        require(
            batches[_batchId].currentOwner == msg.sender ||
            roles[msg.sender] == Role.Regulator,
            "Only current owner or Regulator can link documents"
        );

        // Append to the immutable history — never overwritten
        ipfsHistory[_batchId].push(IPFSRecord({
            ipfsHash:   _ipfsHash,
            uploadedBy: msg.sender,
            timestamp:  block.timestamp,
            docType:    _docType
        }));

        // Update convenience pointer on the batch struct to the latest CID
        batches[_batchId].ipfsHash = _ipfsHash;

        emit IPFSDocumentLinked(_batchId, _ipfsHash, msg.sender, _docType, block.timestamp);
    }

    /**
     * @notice Returns the full IPFS document history for a batch.
     *         Every CID ever linked is returned in chronological order,
     *         giving auditors a complete document provenance trail.
     * @param _batchId ID of the batch to query.
     */
    function getIPFSHistory(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (IPFSRecord[] memory)
    {
        return ipfsHistory[_batchId];
    }
}
