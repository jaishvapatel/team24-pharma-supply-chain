# Pharmaceutical Supply Chain Traceability System

## Overview

This project is a blockchain-based pharmaceutical supply chain application built for **CSE 540: Engineering Blockchain Applications**. The goal is to improve transparency, traceability, and authenticity verification for drug batches as they move across stakeholders.

The system uses Ethereum smart contracts to record traceability data on-chain, while documents are stored off-chain using IPFS.

## Problem Statement

Pharmaceutical supply chains suffer from:

* counterfeit drugs
* tampering and diversion
* fragmented systems
* lack of trust and traceability

This system provides a secure and verifiable way to track drug batches.

## Features

* Register drug batches
* Transfer ownership across stakeholders
* Verify authenticity at pharmacy level
* Maintain immutable audit trail
* Store documents using IPFS
* Role-based access control


## Tech Stack

### Blockchain Layer
- **Ethereum (Sepolia Testnet):** Used for deploying and executing smart contracts in a decentralized environment.
- **Solidity:** Programming language used to implement smart contract logic for traceability and verification.

### Development & Testing
- **Hardhat:** Development framework for compiling, testing, and deploying smart contracts.
- **Ethers.js / Web3.js:** Libraries for interacting with smart contracts from the frontend.

### Frontend Layer
- **React.js:** Used to build a user-friendly decentralized application (dApp) interface.
- **MetaMask:** Wallet integration for user authentication and transaction signing.

### Storage Layer
- **IPFS (InterPlanetary File System):** Used for storing large documents such as certificates and reports off-chain, with their hashes stored on-chain for integrity verification.

### Networking
- **Sepolia Test Network:** Enables cost-effective testing and deployment without real ETH usage.


## Repository Structure

```text
pharma-supply-chain/
├── contracts/
│   └── PharmaceuticalSupplyChain.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── PharmaceuticalSupplyChain.test.js
├── frontend/
├── README.md
├── hardhat.config.js
└── .gitignore
```

## Smart Contract Overview

The smart contract is the core component of the system, responsible for enforcing business logic, managing ownership, and ensuring data integrity across the pharmaceutical supply chain.

### Role-Based Access Control (RBAC)

Each participant is assigned a role that determines their permissions:
- **Manufacturer:** Can register new drug batches
- **Distributor:** Can receive and transfer ownership
- **Pharmacy:** Can verify authenticity of batches
- **Regulator:** Can monitor system activity
- **Consumer:** Can view batch history

Access control is enforced using role mappings and modifiers to restrict function execution.


### Data Structures

#### Batch Structure
Stores essential information about each drug batch:
- Batch ID (unique identifier)
- Manufacturer address
- Current owner address
- IPFS hash (off-chain data reference)
- Verification status
- Timestamp of creation

#### Transfer History
Maintains an immutable log of ownership changes:
- Sender address
- Receiver address
- Timestamp
- Optional transfer notes


### Core Functionalities

- **Batch Registration:**  
  Manufacturers register a new drug batch with a unique ID and IPFS hash.

- **Ownership Transfer:**  
  Enables secure custody transfer between authorized participants, updating both current ownership and history.

- **Batch Verification:**  
  Pharmacies verify the authenticity and integrity of drug batches.

- **Audit Trail Retrieval:**  
  Users can query full batch history for transparency and traceability.


### Event Logging

Smart contracts emit events for all critical actions:
- Batch registration
- Ownership transfer
- Verification

These events provide a transparent and immutable audit trail that can be accessed by the frontend.

## Setup Instructions

### Install dependencies

```bash
npm install
```

### Compile contracts

```bash
npx hardhat compile
```

### Run tests

```bash
npx hardhat test
```

## Deployment

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Frontend Setup

```bash
cd frontend
npm install
npm start
```


## Usage Flow

1. Manufacturer registers batch
2. Distributor transfers ownership
3. Pharmacy verifies batch
4. Consumer checks batch via QR or ID


## Security Considerations

### Access Control
- Role-based permissions ensure only authorized users can perform sensitive actions.
- Smart contract modifiers restrict function execution based on roles.

### Data Integrity
- Blockchain ensures immutability of batch records once created.
- Any modification attempts are prevented by design.

### Input Validation
- Checks are implemented to prevent:
  - duplicate batch registrations
  - invalid addresses
  - unauthorized ownership transfers

### Ownership Verification
- Only the current owner of a batch can transfer ownership.
- Prevents unauthorized custody changes.

### Off-Chain Data Security
- Documents are stored on IPFS.
- Only the **hash of the document** is stored on-chain.
- Any tampering with off-chain files can be detected by comparing hashes.

### Event Transparency
- All transactions emit events, ensuring traceability and auditability.
- Enables real-time monitoring and debugging.

### Gas Optimization (Design Consideration)
- Only essential data is stored on-chain to reduce transaction costs.
- Large files and metadata are stored off-chain.

### Limitations & Future Improvements
- No advanced authentication (e.g., multi-signature wallets)
- No integration with external systems (ERP/IoT)
- Future work could include zero-knowledge proofs or enhanced identity verification


## Project Scope

This is a Minimum Viable Product (MVP) focusing on:

* traceability
* ownership transfer
* verification


## Team Members

* Anannya Reddy Gade
* Sriveda Chintapalli
* Chaitanya Sulam
* Sri Ram Charan Penmatcha
* Jaishva Baijubhai Patel


## License

Academic project for CSE 540
