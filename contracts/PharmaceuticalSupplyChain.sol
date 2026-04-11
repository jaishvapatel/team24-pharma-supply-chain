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
    // Each participant in the supply chain is assigned one of these roles.
    // The role determines which contract functions they can call.
    enum Role {
        None,           // Default — no permissions
        Manufacturer,   // Can register new drug batches
        Distributor,    // Can receive and forward batches
        Pharmacy,       // Can receive, verify, and flag batches
        Regulator,      // Can audit and flag batches
        Consumer        // Can view batch provenance (read-only on-chain)
    }

    // ── Batch lifecycle states ───────────────────────────────────────
    // A batch moves through these states as it travels the supply chain.
    enum BatchStatus {
        Registered,     // Just created by manufacturer
        InTransit,      // Ownership transferred, awaiting receipt
        Received,       // Recipient confirmed receipt
        Verified,       // Pharmacy confirmed authenticity
        Flagged         // Marked as suspicious by pharmacy or regulator
    }

    // ── Data structures ──────────────────────────────────────────────

    // Holds all on-chain metadata for a single drug batch.
    // Off-chain documents (certificates, lab reports) are stored on IPFS
    // and referenced here by their content hash.
    struct DrugBatch {
        string  batchId;          // Unique human-readable ID (e.g., "BATCH-2026-001")
        string  drugName;         // Name of the pharmaceutical product
        address currentOwner;     // Wallet address of the current custodian
        BatchStatus status;       // Current lifecycle state
        uint256 manufactureDate;  // Unix timestamp — when the batch was produced
        uint256 expiryDate;       // Unix timestamp — when the batch expires
        string  ipfsHash;         // IPFS CID pointing to supporting documents
    }

    // Records a single custody change for audit trail purposes.
    struct TransferRecord {
        address from;       // Who sent the batch
        address to;         // Who received the batch
        uint256 timestamp;  // When the transfer happened (block timestamp)
        string  note;       // Free-text note (shipment ID, location, etc.)
    }

    // ── State variables ──────────────────────────────────────────────

    address public admin;  // Deployer — can assign roles to participants

    mapping(address => Role)              public roles;            // address → role
    mapping(string  => DrugBatch)         public batches;          // batchId → batch data
    mapping(string  => TransferRecord[])  public transferHistory;  // batchId → list of transfers

    // Simple counter so we can iterate over all batch IDs
    string[] public batchIds;

    // ── Events ───────────────────────────────────────────────────────
    // Events are emitted when important state changes occur.
    // Off-chain indexers and the frontend listen for these.

    event BatchRegistered(
        string  batchId,
        string  drugName,
        address manufacturer,
        uint256 timestamp
    );

    event OwnershipTransferred(
        string  batchId,
        address from,
        address to,
        uint256 timestamp
    );

    event BatchReceived(
        string  batchId,
        address receiver,
        uint256 timestamp
    );

    event BatchVerified(
        string  batchId,
        address verifiedBy,
        uint256 timestamp
    );

    event BatchFlagged(
        string  batchId,
        address flaggedBy,
        string  reason,
        uint256 timestamp
    );

    event RoleAssigned(address account, Role role);

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

    /**
     * @notice Assign a supply-chain role to a wallet address.
     * @param _account The participant's wallet address.
     * @param _role    The role to assign.
     */
    function assignRole(address _account, Role _role) external onlyAdmin {
        roles[_account] = _role;
        emit RoleAssigned(_account, _role);
    }

    /**
     * @notice Look up the role for any address.
     */
    function getRole(address _account) external view returns (Role) {
        return roles[_account];
    }

    // ── Batch registration ───────────────────────────────────────────

    /**
     * @notice Register a new drug batch on-chain.
     *         Only a Manufacturer can call this.
     * @param _batchId         Unique identifier for the batch.
     * @param _drugName        Name of the drug.
     * @param _manufactureDate Unix timestamp of production date.
     * @param _expiryDate      Unix timestamp of expiry date.
     * @param _ipfsHash        IPFS CID for off-chain documents.
     */
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

        batchIds.push(_batchId);
        emit BatchRegistered(_batchId, _drugName, msg.sender, block.timestamp);
    }

    // ── Ownership transfer ───────────────────────────────────────────

    /**
     * @notice Transfer custody of a batch to the next stakeholder.
     *         Only the current owner can initiate this.
     * @param _batchId ID of the batch.
     * @param _to      Address of the new custodian.
     * @param _note    Optional shipment note.
     */
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

    /**
     * @notice Confirm receipt of a batch shipment.
     *         Only the current owner (recipient) can call this.
     */
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

    /**
     * @notice Verify a batch as authentic.
     *         Only a Pharmacy can call this.
     */
    function verifyBatch(string memory _batchId)
        external
        batchExists(_batchId)
        onlyRole(Role.Pharmacy)
    {
        batches[_batchId].status = BatchStatus.Verified;
        emit BatchVerified(_batchId, msg.sender, block.timestamp);
    }

    // ── Flagging ─────────────────────────────────────────────────────

    /**
     * @notice Flag a batch as suspicious or tampered.
     *         Only Pharmacy or Regulator can call this.
     */
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

    /**
     * @notice Get full details of a drug batch.
     */
    function getBatch(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (DrugBatch memory)
    {
        return batches[_batchId];
    }

    /**
     * @notice Get the complete chain-of-custody history.
     */
    function getHistory(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (TransferRecord[] memory)
    {
        return transferHistory[_batchId];
    }

    /**
     * @notice Get total number of registered batches.
     */
    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }

    /**
     * @notice Get a batch ID by index (for iteration).
     */
    function getBatchIdByIndex(uint256 _index) external view returns (string memory) {
        require(_index < batchIds.length, "Index out of bounds");
        return batchIds[_index];
    }
}
