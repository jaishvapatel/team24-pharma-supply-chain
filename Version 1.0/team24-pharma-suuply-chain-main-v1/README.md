# Pharmaceutical Supply Chain Traceability System

## Overview

A blockchain-based system that tracks pharmaceutical drug batches from manufacturer to consumer using Ethereum smart contracts. Each custody transfer is recorded immutably on-chain, providing a verifiable audit trail for regulatory compliance and counterfeit prevention.

**Course:** CSE 540 — Engineering Blockchain Applications  
**Team:** Team 24 | Spring B 2026

---

## Features

- **Batch Registration** — Manufacturers register drug batches with metadata and IPFS document hashes
- **Custody Transfer** — Track ownership changes through Manufacturer → Distributor → Pharmacy
- **Receipt Confirmation** — Recipients confirm shipment arrival, updating batch status
- **Authenticity Verification** — Pharmacies verify batches as authentic
- **Flagging System** — Regulators and pharmacies can flag suspicious batches
- **Audit Trail** — Complete chain-of-custody history for every batch
- **Role-Based Access Control** — Five distinct roles with enforced permissions

---

## Tech Stack

| Component         | Technology                        |
|-------------------|-----------------------------------|
| Smart Contract    | Solidity ^0.8.20                  |
| Framework         | Hardhat                           |
| Testing           | Chai + Hardhat Toolbox            |
| Network           | Ethereum (Sepolia Testnet)        |
| Frontend          | HTML/CSS/JS (demo), React (planned) |
| Off-chain Storage | IPFS                              |
| Wallet            | MetaMask                          |

---

## Repository Structure

```
pharma-supply-chain/
├── contracts/
│   └── PharmaceuticalSupplyChain.sol    # Main smart contract
├── scripts/
│   ├── deploy.js                        # Deployment script
│   └── demo.js                          # Full end-to-end demo script
├── test/
│   └── PharmaceuticalSupplyChain.test.js  # Unit tests (25+ test cases)
├── frontend/
│   └── demo.html                        # Interactive demo page
├── hardhat.config.js
├── package.json
└── README.md
```

---

## Setup Instructions

### Prerequisites

- Node.js v18+
- npm

### Install Dependencies

```bash
cd pharma-supply-chain
npm install
```

### Compile the Contract

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Run the Full Demo

```bash
npx hardhat run scripts/demo.js
```

This runs an end-to-end simulation:
1. Deploys the contract
2. Assigns roles to 5 wallets
3. Registers a drug batch
4. Transfers custody: Manufacturer → Distributor → Pharmacy
5. Pharmacy verifies the batch
6. Queries the full audit trail
7. Regulator flags a second batch

### Interactive Frontend Demo

Open `frontend/demo.html` in any browser — no setup needed. Click through each step to see the supply chain flow visualized in real time.

---

## Smart Contract Overview

### Roles

| Role          | Permissions                          |
|---------------|--------------------------------------|
| Admin         | Assign roles to addresses            |
| Manufacturer  | Register new drug batches            |
| Distributor   | Receive and forward batches          |
| Pharmacy      | Receive, verify, and flag batches    |
| Regulator     | Audit and flag batches               |
| Consumer      | View batch provenance (read-only)    |

### Key Functions

| Function              | Access          | Description                              |
|-----------------------|-----------------|------------------------------------------|
| `assignRole()`        | Admin           | Assign a supply chain role               |
| `registerBatch()`     | Manufacturer    | Register a new drug batch on-chain       |
| `transferOwnership()` | Current Owner   | Transfer custody to next stakeholder     |
| `receiveShipment()`   | Current Owner   | Confirm receipt of a batch               |
| `verifyBatch()`       | Pharmacy        | Mark batch as verified/authentic         |
| `flagBatch()`         | Pharmacy/Regulator | Flag a suspicious batch              |
| `getBatch()`          | Anyone          | View batch details                       |
| `getHistory()`        | Anyone          | View full transfer history               |

### Events

- `BatchRegistered` — New batch created
- `OwnershipTransferred` — Custody changed
- `BatchReceived` — Shipment receipt confirmed
- `BatchVerified` — Batch verified as authentic
- `BatchFlagged` — Batch flagged as suspicious
- `RoleAssigned` — Role assigned to an address

---

## Deployment

### Local (Hardhat Network)

```bash
npx hardhat run scripts/deploy.js
```

### Sepolia Testnet

1. Add your Infura/Alchemy key and wallet private key to `hardhat.config.js`
2. Run:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Team Members

- Anannya Reddy Gade
- Sriveda Chintapalli
- Chaitanya Sulam
- Sri Ram Charan Penmatcha
- Jaishva Baijubhai Patel

---

## License

Academic project — CSE 540, Arizona State University
