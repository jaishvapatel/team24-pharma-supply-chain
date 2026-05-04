# IPFS Off-Chain Storage Integration
### Team 24 – Pharmaceutical Supply Chain (CSE 540)

---

## Overview

This integration adds a **complete IPFS off-chain storage layer** to the existing
Pharmaceutical Supply Chain smart contract. All large/sensitive data (batch metadata,
lab reports, COAs, shipping manifests) is stored on IPFS while only the
**content identifier (CID)** is anchored on-chain.

```
┌────────────────────────┐        ┌──────────────────────────┐
│   React Frontend       │        │   Ethereum / Sepolia     │
│                        │        │                          │
│  RegisterBatch.jsx  ──────────▶ │  registerBatch(         │
│  TransferOwnership.jsx │        │    batchId,             │
│  BatchViewer.jsx       │        │    …,                   │
│                        │        │    metadataCID  ◀───┐   │
└──────────┬─────────────┘        └──────────────────────┘   │
           │                                                   │
           │  uploadMetadata() / uploadFile()                  │
           ▼                                                   │
┌──────────────────────┐                                       │
│   IPFS / Pinata      │  returns CID ─────────────────────────┘
│                      │
│  Batch Metadata JSON │
│  COA PDF             │
│  Shipping Manifest   │
│  Recall Notices      │
└──────────────────────┘
```

---

## New Files

| File | Purpose |
|------|---------|
| `contracts/PharmaceuticalSupplyChain.sol` | Updated contract — stores `metadataCID`, `documents[]`, history CIDs |
| `frontend/src/utils/ipfsService.js` | Core IPFS service (Pinata + local Kubo fallback) |
| `frontend/src/hooks/useIPFS.js` | React hook wrapping ipfsService with loading/error state |
| `frontend/src/components/RegisterBatch.jsx` | Batch registration UI with IPFS upload |
| `frontend/src/components/TransferOwnership.jsx` | Transfer UI with IPFS transfer doc upload |
| `frontend/src/components/BatchViewer.jsx` | Full batch viewer — resolves all CIDs from IPFS |
| `scripts/deploy.js` | Deploy script — auto-writes ABI + address to frontend |
| `test/PharmaceuticalSupplyChain.test.js` | Full test suite including IPFS CID storage |

---

## Setup

### 1. Install dependencies

```bash
npm install
cd frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in:
#   PRIVATE_KEY          – deployer wallet
#   SEPOLIA_RPC_URL      – Infura / Alchemy endpoint
#   REACT_APP_PINATA_API_KEY / SECRET – from app.pinata.cloud
```

### 3. Compile & test

```bash
npx hardhat compile
npx hardhat test
```

### 4. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
# deploy.js automatically writes the contract address to frontend/.env
```

### 5. Start the frontend

```bash
cd frontend
npm start
```

---

## IPFS Service Details (`ipfsService.js`)

### Upload strategy

| Condition | Provider |
|-----------|----------|
| `REACT_APP_PINATA_API_KEY` is set | **Pinata** (cloud pinning, CIDv1) |
| No Pinata keys | **Local Kubo** node at `localhost:5001` |

### Key exports

```js
uploadMetadata(obj, name)       // Upload JSON → returns CID
uploadFile(file, name)          // Upload File/Blob → returns CID
fetchMetadata(cid)              // Fetch JSON from IPFS (multi-gateway fallback)
gatewayURL(cid)                 // Returns public gateway URL
buildBatchMetadata(params)      // Builds standardised batch metadata object
buildTransferDocument(params)   // Builds standardised transfer document object
listBatchPins(batchId)          // List all Pinata pins for a batch
unpinCID(cid)                   // Remove a pin from Pinata
```

---

## Smart Contract Changes

### New fields on `Batch`

```solidity
string metadataCID;          // Primary IPFS CID (uploaded at registration)
BatchDocument[] documents;   // Additional docs attached post-registration
```

### New struct `BatchDocument`

```solidity
struct BatchDocument {
    string  ipfsCID;
    string  docType;       // "lab_report", "recall_notice", "invoice", …
    uint256 uploadedAt;
    address uploadedBy;
}
```

### Updated `HistoryEntry`

```solidity
struct HistoryEntry {
    address from;
    address to;
    uint256 timestamp;
    string  action;
    string  ipfsCID;       // shipping doc / transfer note CID
}
```

### New function `attachDocument`

```solidity
function attachDocument(string batchId, string ipfsCID, string docType) external
```

Allows any non-Consumer, non-None role to attach additional IPFS documents
to a batch at any point in its lifecycle.

---

## Usage Flow (with IPFS)

```
Manufacturer
  → fill in batch form + optional COA upload
  → ipfsService uploads metadata JSON to IPFS → CID₁
  → ipfsService uploads COA file to IPFS      → CID₂  (if file provided)
  → registerBatch(batchId, …, CID₁) on-chain
  → attachDocument(batchId, CID₂, "coa")     on-chain

Distributor
  → fill in transfer form + optional shipping doc
  → ipfsService uploads transfer JSON to IPFS → CID₃
  → transferOwnership(batchId, pharmacy, CID₃) on-chain

Pharmacy
  → verifyBatch(batchId) on-chain
  → BatchViewer fetches getBatch() + getHistory() + getDocument()
  → For each CID, fetchMetadata() resolves full data from IPFS
  → Renders complete audit trail with IPFS document links
```

---

## Security Notes

- CIDs are **content-addressed** — any tampering changes the CID, making forgery detectable.
- The contract stores CIDs immutably; documents on IPFS are append-only.
- Use **Pinata** in production for reliable pinning; local Kubo is for development only.
- Sensitive documents (patient data) should be **encrypted** before uploading to IPFS.

---

## License

Academic project – CSE 540, Team 24
