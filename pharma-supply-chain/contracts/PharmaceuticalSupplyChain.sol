// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PharmaceuticalSupplyChain
 * @dev Blockchain-based provenance tracking system for pharmaceutical products.
 *      Records drug batch registration, custody transfers, and verification
 *      across all supply chain stakeholders on the Ethereum network.
 *      Team 24 | CSE 540 | Spring B 2026
 */
contract PharmaceuticalSupplyChain {

    /**
     * @dev Defines the roles available to participants in the supply chain.
     *      Each address is assigned exactly one role via assignRole().
     */
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Pharmacy,
        Regulator,
        Consumer
    }

    /**
     * @dev Tracks the current status of a drug batch as it moves
     *      through the supply chain lifecycle.
     */
    enum BatchStatus {
        Registered,
        InTransit,
        Received,
        Verified,
        Flagged
    }

    /**
     * @dev Stores all on-chain metadata for a registered drug batch.
     *      Off-chain documents (e.g., certificates) are referenced via ipfsHash.
     */
    struct DrugBatch {
        string batchId;           // Unique identifier for the drug batch
        string drugName;          // Name of the pharmaceutical product
        address currentOwner;     // Address of the current custodian
        BatchStatus status;       // Current status in the supply chain
        uint256 manufactureDate;  // Unix timestamp of manufacture
        uint256 expiryDate;       // Unix timestamp of expiry
        string ipfsHash;          // IPFS hash pointing to off-chain documents
    }

    /**
     * @dev Records a single custody transfer event for audit trail purposes.
     */
    struct TransferRecord {
        address from;        // Previous custodian
        address to;          // New custodian
        uint256 timestamp;   // When the transfer occurred
        string note;         // Optional note (e.g., shipment ID, location)
    }


    /// @dev Contract deployer — has admin privileges to assign roles
    address public admin;

    /// @dev Maps each address to its assigned role
    mapping(address => Role) public roles;

    /// @dev Maps each batchId to its DrugBatch struct
    mapping(string => DrugBatch) public batches;

    /// @dev Maps each batchId to its full transfer history
    mapping(string => TransferRecord[]) public transferHistory;

    /// @dev Emitted when a new drug batch is registered on-chain
    event BatchRegistered(string batchId, string drugName, address manufacturer, uint256 timestamp);

    /// @dev Emitted when custody of a batch is transferred between stakeholders
    event OwnershipTransferred(string batchId, address from, address to, uint256 timestamp);

    /// @dev Emitted when a pharmacy verifies a batch as authentic
    event BatchVerified(string batchId, address verifiedBy, uint256 timestamp);

    /// @dev Emitted when a batch is flagged as potentially counterfeit or tampered
    event BatchFlagged(string batchId, address flaggedBy, string reason, uint256 timestamp);

    /// @dev Emitted when a role is assigned to an address
    event RoleAssigned(address account, Role role);

    /// @dev Restricts function access to the contract admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "Access denied: admin only");
        _;
    }

    /// @dev Restricts function access to a specific role
    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Access denied: incorrect role");
        _;
    }

    /// @dev Ensures the caller is the current owner of the batch
    modifier onlyCurrentOwner(string memory _batchId) {
        require(batches[_batchId].currentOwner == msg.sender, "Access denied: not current owner");
        _;
    }

    /// @dev Ensures a batch with the given ID exists
    modifier batchExists(string memory _batchId) {
        require(bytes(batches[_batchId].batchId).length > 0, "Batch does not exist");
        _;
    }

    /**
     * @dev Sets the deploying address as the admin.
     */
    constructor() {
        admin = msg.sender;
    }


    /**
     * @dev Assigns a role to a supply chain participant.
     *      Only callable by the admin.
     * @param _account Address of the participant
     * @param _role Role to assign (Manufacturer, Distributor, etc.)
     */
    function assignRole(address _account, Role _role) external onlyAdmin {
        roles[_account] = _role;
        emit RoleAssigned(_account, _role);
    }

    /**
     * @dev Returns the role of a given address.
     * @param _account Address to query
     */
    function getRole(address _account) external view returns (Role) {
        return roles[_account];
    }


    /**
     * @dev Registers a new drug batch on the blockchain.
     *      Only callable by an address with the Manufacturer role.
     * @param _batchId Unique identifier for the batch
     * @param _drugName Name of the drug
     * @param _manufactureDate Unix timestamp of the manufacture date
     * @param _expiryDate Unix timestamp of expiry date
     * @param _ipfsHash IPFS hash for off-chain documents (e.g., certificates)
     */
    function registerBatch(
        string memory _batchId,
        string memory _drugName,
        uint256 _manufactureDate,
        uint256 _expiryDate,
        string memory _ipfsHash
    ) external onlyRole(Role.Manufacturer) {
        require(bytes(batches[_batchId].batchId).length == 0, "Batch ID already exists");

        batches[_batchId] = DrugBatch({
            batchId: _batchId,
            drugName: _drugName,
            currentOwner: msg.sender,
            status: BatchStatus.Registered,
            manufactureDate: _manufactureDate,
            expiryDate: _expiryDate,
            ipfsHash: _ipfsHash
        });

        emit BatchRegistered(_batchId, _drugName, msg.sender, block.timestamp);
    }

    /**
     * @dev Transfers custody of a batch to another stakeholder.
     *      Only callable by the current owner of the batch.
     * @param _batchId ID of the batch to transfer
     * @param _to Address of the new custodian
     * @param _note Optional note describing the transfer (e.g., shipment ID)
     */
    function transferOwnership(
        string memory _batchId,
        address _to,
        string memory _note
    ) external batchExists(_batchId) onlyCurrentOwner(_batchId) {
        require(_to != address(0), "Invalid recipient address");
        require(roles[_to] != Role.None, "Recipient has no assigned role");

        address previousOwner = batches[_batchId].currentOwner;
        batches[_batchId].currentOwner = _to;
        batches[_batchId].status = BatchStatus.InTransit;

        transferHistory[_batchId].push(TransferRecord({
            from: previousOwner,
            to: _to,
            timestamp: block.timestamp,
            note: _note
        }));

        emit OwnershipTransferred(_batchId, previousOwner, _to, block.timestamp);
    }

    /**
     * @dev Marks a batch as verified after authenticity check.
     *      Only callable by an address with the Pharmacy role.
     * @param _batchId ID of the batch to verify
     */
    function verifyBatch(string memory _batchId)
        external
        batchExists(_batchId)
        onlyRole(Role.Pharmacy)
    {
        batches[_batchId].status = BatchStatus.Verified;
        emit BatchVerified(_batchId, msg.sender, block.timestamp);
    }

    /**
     * @dev Flags a batch as potentially counterfeit or tampered.
     *      Callable by Regulators or Pharmacies.
     * @param _batchId ID of the batch to flag
     * @param _reason Description of the reason for flagging
     */
    function flagBatch(string memory _batchId, string memory _reason)
        external
        batchExists(_batchId)
    {
        require(
            roles[msg.sender] == Role.Regulator || roles[msg.sender] == Role.Pharmacy,
            "Access denied: only Regulator or Pharmacy can flag"
        );
        batches[_batchId].status = BatchStatus.Flagged;
        emit BatchFlagged(_batchId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @dev Returns the full details of a drug batch.
     * @param _batchId ID of the batch to query
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
     * @dev Returns the complete transfer history of a batch for audit purposes.
     * @param _batchId ID of the batch to query
     */
    function getHistory(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (TransferRecord[] memory)
    {
        return transferHistory[_batchId];
    }
}
