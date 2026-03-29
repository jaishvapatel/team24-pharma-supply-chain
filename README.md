# Pharmaceutical Supply Chain Traceability System

## Overview

This project is a blockchain-based pharmaceutical supply chain application built for **CSE 540: Engineering Blockchain Applications**. The goal is to improve transparency, traceability, and authenticity verification for drug batches as they move across stakeholders.

The system uses Ethereum smart contracts to record traceability data on-chain, while documents are stored off-chain using IPFS.

---

## Problem Statement

Pharmaceutical supply chains suffer from:

* counterfeit drugs
* tampering and diversion
* fragmented systems
* lack of trust and traceability

This system provides a secure and verifiable way to track drug batches.

---

## Features

* Register drug batches
* Transfer ownership across stakeholders
* Verify authenticity at pharmacy level
* Maintain immutable audit trail
* Store documents using IPFS
* Role-based access control

---

## Tech Stack

* Solidity
* Ethereum (Sepolia Testnet)
* Hardhat
* React.js
* Web3.js / ethers.js
* MetaMask
* IPFS

---

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

---

## Smart Contract Overview

### Roles

* Manufacturer
* Distributor
* Pharmacy
* Regulator
* Consumer

### Functions

* assignRole()
* registerBatch()
* transferOwnership()
* verifyBatch()
* getBatch()
* getHistory()

---

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

---

## Deployment

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

---

## Usage Flow

1. Manufacturer registers batch
2. Distributor transfers ownership
3. Pharmacy verifies batch
4. Consumer checks batch via QR or ID

---

## Security Considerations

* Role-based permissions
* Immutable records
* Minimal on-chain data
* IPFS hash verification

---

## Project Scope

This is a Minimum Viable Product (MVP) focusing on:

* traceability
* ownership transfer
* verification

---

## Team Members

* Anannya Reddy Gade
* Sriveda Chintapalli
* Chaitanya Sulam
* Sri Ram Charan Penmatcha
* Jaishva Baijubhai Patel

---

## License

Academic project for CSE 540
