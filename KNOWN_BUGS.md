# 🐛 Known Bugs & Fixes

> A complete record of every issue encountered during development and deployment of the Pharma Supply Chain IPFS integration — and exactly how each one was resolved.
>
> **Team 24 · CSE 540 – Engineering Blockchain Applications**

---

## Table of Contents

1. [Network Sepolia doesn't exist](#1-network-sepolia-doesnt-exist)
2. [Private key too short](#2-private-key-too-short)
3. [Solidity version mismatch](#3-solidity-version-mismatch)
4. [Insufficient funds for gas](#4-insufficient-funds-for-gas)
5. [Missing npm start script](#5-missing-npm-start-script)
6. [App shows default React logo](#6-app-shows-default-react-logo)
7. [Component files not found](#7-component-files-not-found)
8. [MetaMask shows Ethereum Mainnet](#8-metamask-shows-ethereum-mainnet)
9. [Invalid contract address on Etherscan](#9-invalid-contract-address-on-etherscan)
10. [Batch Viewer NetworkError](#10-batch-viewer-networkerror)
11. [BAD_DATA when calling getBatch](#11-bad_data-when-calling-getbatch)
12. [Contract address reads as a number](#12-contract-address-reads-as-a-number)
13. [Only admin can call this](#13-only-admin-can-call-this)
14. [Recipient has invalid role](#14-recipient-has-invalid-role)

---

## 1. Network Sepolia doesn't exist

**Error**
```
Error HH100: Network sepolia doesn't exist
```

**Cause**
A third-party VS Code extension (**Vest Auth**) was intercepting the `.env` file and blocking environment variables from loading into Hardhat. As a result, `process.env.SEPOLIA_RPC_URL` was always `undefined`, and Hardhat silently dropped the Sepolia network from its config.

**Fix**
Bypassed `.env` entirely by hardcoding values directly in `hardhat.config.js`:

```js
module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
      accounts: ["0xYOUR_PRIVATE_KEY"],
    },
  },
};
```

**Prevention**
Uninstall the Vest Auth VS Code extension. Once removed, `.env` loads correctly and hardcoded values can be replaced with `process.env` references.

---

## 2. Private key too short

**Error**
```
Error HH8: Invalid account: #0 for network: sepolia - private key too short, expected 32 bytes
```

**Cause**
The wallet **address** was used instead of the **private key**. They look similar but are completely different:

| | Wallet Address | Private Key |
|---|---|---|
| Length | 42 characters | 66 characters |
| Example | `0x324fBfB926...` | `0xa1b2c3d4e5f6...` (64 hex chars after `0x`) |
| Safe to share? | ✅ Yes | ❌ Never |

**Fix**
Exported the correct private key from MetaMask:
> MetaMask → Circle avatar → Account Details → Show Private Key → enter password → hold to reveal → copy

Verified correct length before use:
```bash
node -e "const k='0xYOUR_KEY'; console.log('Valid:', k.length === 66);"
```

---

## 3. Solidity version mismatch

**Error**
```
Error HH606: The Solidity version pragma statement in these files doesn't match
any of the configured compilers.
* contracts/PharmaceuticalSupplyChain.sol (^0.8.20)
```

**Cause**
`hardhat.config.js` specified `solidity: "0.8.19"` but the contract declared `pragma solidity ^0.8.20`.

**Fix**
Updated the version in `hardhat.config.js`:

```diff
- solidity: "0.8.19",
+ solidity: "0.8.20",
```

---

## 4. Insufficient funds for gas

**Error**
```
ProviderError: insufficient funds for gas * price + value: have 0 want 2834787206445
```

**Cause**
The deployer wallet had 0 Sepolia ETH. Gas fees must be paid even on testnets.

**Fix**
Obtained free Sepolia ETH from a faucet:
- [sepoliafaucet.com](https://sepoliafaucet.com) — requires Alchemy account
- [cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) — no account needed

Verified balance before redeploying:
```
https://sepolia.etherscan.io/address/YOUR_WALLET_ADDRESS
```

---

## 5. Missing npm start script

**Error**
```
npm error Missing script: "start"
```

**Cause**
The `frontend/` folder contained component files but had no React app scaffolded — no `package.json` with a `start` script existed.

**Fix**
Scaffolded a proper React app, then recreated the folder structure:

```bash
npx create-react-app frontend
cd frontend
npm install ethers
mkdir src/components src/utils src/hooks src/abi
```

Then created component files inside `src/components/`.

---

## 6. App shows default React logo

**Symptom**
App starts at `localhost:3000` but shows the spinning React logo and "Edit src/App.js to reload."

**Cause**
`src/App.js` still contained the default Create React App boilerplate — our actual components had never been wired up.

**Fix**
Replaced `src/App.js` entirely with a nav bar and page router:

```jsx
function App() {
  const [page, setPage] = React.useState('register');
  return (
    <div>
      <nav>
        <button onClick={() => setPage('register')}>Register Batch</button>
        <button onClick={() => setPage('transfer')}>Transfer Ownership</button>
        <button onClick={() => setPage('view')}>View Batch</button>
      </nav>
      {page === 'register' && <RegisterBatch />}
      {page === 'transfer' && <TransferOwnership />}
      {page === 'view'     && <BatchViewer />}
    </div>
  );
}
```

---

## 7. Component files not found

**Error**
```
Module not found: Error: Can't resolve './components/RegisterBatch'
Module not found: Error: Can't resolve './components/TransferOwnership'
Module not found: Error: Can't resolve './components/BatchViewer'
```

**Cause**
The component files had not been created inside the React app's `src/components/` directory.

**Fix**
Created all three files manually:
```bash
# Windows
notepad src\components\RegisterBatch.jsx
notepad src\components\TransferOwnership.jsx
notepad src\components\BatchViewer.jsx
```

Verified they existed before restarting:
```bash
dir src\components\
```

---

## 8. MetaMask shows Ethereum Mainnet

**Symptom**
MetaMask popup shows `Network: Ethereum` with a red **"Review alert"** button instead of a normal Confirm button.

**Cause**
MetaMask defaults to Ethereum Mainnet. Confirming on Mainnet would spend **real ETH**, not test ETH.

**Fix**
Added an automatic network switch at the start of every transaction in each component:

```js
await window.ethereum.request({ method: "eth_requestAccounts" });

// Force switch to Sepolia
try {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }], // Sepolia chain ID
  });
} catch (err) {
  if (err.code === 4902) {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0xaa36a7", chainName: "Sepolia Testnet",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://rpc.sepolia.org"] }],
    });
  }
}
```

> ⚠️ **Never confirm a transaction when MetaMask shows "Ethereum Mainnet"** — always cancel and switch to Sepolia first.

---

## 9. Invalid contract address on Etherscan

**Symptom**
Etherscan returns `Address (Invalid Address)` with no transactions found.

**Cause**
The contract had never been successfully deployed. Previous deploy attempts had failed mid-way, leaving no valid contract on-chain.

**Fix**
Redeployed cleanly after ensuring:
1. Wallet had sufficient Sepolia ETH
2. Correct private key was in `hardhat.config.js`
3. Contract compiled without errors

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Verified the new address immediately on Sepolia Etherscan before proceeding.

---

## 10. Batch Viewer NetworkError

**Error**
```
❌ NetworkError when attempting to fetch resource.
```

**Cause**
The free public RPC endpoint `https://rpc.sepolia.org` is unreliable and frequently times out.

**Fix**
Switched to the Alchemy RPC URL (the same one used for deployment) in `BatchViewer.jsx`:

```diff
- const RPC_URL = process.env.REACT_APP_RPC_URL || "https://rpc.sepolia.org";
+ const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY";
```

Also updated `REACT_APP_RPC_URL` in `frontend/.env` to the Alchemy URL.

---

## 11. BAD_DATA when calling getBatch

**Error**
```
could not decode result data (value="0x", info={ "method": "getBatch",
"signature": "getBatch(string)" }, code=BAD_DATA, version=6.16.0)
```

**Cause**
The ABI in `src/abi/PharmaceuticalSupplyChain.json` did not match the contract actually deployed on-chain. The deployed contract was the **original Team 24 contract** (with `_batchId` parameter names) instead of our updated IPFS version (with `batchId` parameter names).

Confirmed by checking the ABI:
```bash
node -e "const abi=require('./src/abi/PharmaceuticalSupplyChain.json');
const f=abi.find(x=>x.name==='getBatch');
console.log('inputs:', JSON.stringify(f.inputs));"
# Output showed "_batchId" — wrong contract
```

**Fix**
1. Replaced `contracts/PharmaceuticalSupplyChain.sol` with the IPFS-enabled version
2. Recompiled and redeployed
3. Re-copied the ABI to the frontend:

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia

node -e "
const fs=require('fs');
const a=require('./artifacts/contracts/PharmaceuticalSupplyChain.sol/PharmaceuticalSupplyChain.json');
fs.writeFileSync('./frontend/src/abi/PharmaceuticalSupplyChain.json', JSON.stringify(a.abi, null, 2));
console.log('ABI updated');
"
```

---

## 12. Contract address reads as a number

**Error**
```
invalid value for Contract target (argument="target",
value=9.536822777153869e+46, code=INVALID_ARGUMENT, version=6.16.0)
```

**Cause**
The `REACT_APP_CONTRACT_ADDRESS` environment variable was empty (Vest Auth blocking `.env` again), so ethers.js received an empty string and tried to parse it as a number — producing a scientific notation value instead of a hex address.

**Fix**
Hardcoded the contract address as a proper quoted string directly in each component, bypassing `.env`:

```diff
- const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";
+ const CONTRACT_ADDRESS = "0x35fa02EA965a6A72f4aa8D99768A50AC6abcF21e";
```

Applied to all three components: `RegisterBatch.jsx`, `TransferOwnership.jsx`, `BatchViewer.jsx`.

Cleared the React cache and restarted:
```bash
rd /s /q node_modules\.cache
npm start
```

---

## 13. Only admin can call this

**Error**
```
execution reverted: "Only admin can call this"
```

**Cause**
The `assignRole()` function was being called from the **new test wallet** (`0xF9d2...`), but the contract's admin is the **original deployer wallet** (`0x324f...`). Only the wallet that deployed the contract can assign roles.

**Fix**
Ran the role assignment script using the **original deployer's private key**:

```js
const signer = new ethers.Wallet('0xORIGINAL_DEPLOYER_KEY', provider);
// Not the new test wallet key
```

Verified the correct wallet was being used:
```bash
node -e "
const { ethers } = require('ethers');
const signer = new ethers.Wallet('0xYOUR_KEY');
console.log('Signing as:', signer.address);
// Must print: 0x324fBfB926fb9A2d0b911DfBae9b8667d3BAdd4E
"
```

---

## 14. Recipient has invalid role

**Error**
```
execution reverted: "Recipient has invalid role"
```

**Cause**
Two separate issues combined:

1. The transfer recipient (`0xF9d2...`) had no role assigned on the contract
2. `TransferOwnership.jsx` had a **stale contract address** (`0x10B475...`) hardcoded — it was calling the old contract where no roles existed, not the newly deployed one (`0x35fa02...`)

The stale address was spotted in the error's `transaction.to` field:
```
"to": "0x10B475907bc2DFf7d23646852936E794956c4967"  ← wrong contract
```

**Fix**

Step 1 — Assigned Distributor role on the **correct** contract:
```js
const contract = new ethers.Contract(
  "0x35fa02EA965a6A72f4aa8D99768A50AC6abcF21e", // correct address
  abi,
  signer
);
const tx = await contract.assignRole("0xF9d2a79eA0e263609a90C222B0923023518f875e", 2);
await tx.wait();
```

Step 2 — Fixed the stale address in `TransferOwnership.jsx`:
```diff
- const CONTRACT_ADDRESS = "0x10B475907bc2DFf7d23646852936E794956c4967";
+ const CONTRACT_ADDRESS = "0x35fa02EA965a6A72f4aa8D99768A50AC6abcF21e";
```

---

## ✅ Final Working State

After all 14 fixes, the full flow works end to end:

```
Register Batch  →  IPFS upload (Pinata)  →  CID stored on Sepolia  ✅
Transfer Batch  →  Transfer doc → IPFS   →  Ownership + CID on-chain ✅
View Batch      →  Read chain  →  Fetch IPFS metadata  →  Audit trail ✅
```

---

## 📊 Bug Summary by Category

| Category | Count | Issues |
|---|---|---|
| **Config / Environment** | 4 | Vest Auth blocking `.env` (×2), wrong Solidity version, missing start script |
| **Wallet / Keys** | 3 | Address vs private key, wrong admin wallet, wrong wallet for role assignment |
| **Network** | 2 | No Sepolia ETH, MetaMask on wrong network |
| **Contract / ABI** | 3 | Wrong contract deployed, ABI mismatch, stale address in components |
| **Frontend** | 2 | No React app scaffolded, default boilerplate not replaced |

---

## 💡 Key Takeaways

> **Every address, ABI, and private key must point to the same deployed contract.**
> One stale reference in one file silently breaks the entire system.

- Always verify a new deployment on Etherscan before updating frontend config
- Never confirm a MetaMask transaction that shows "Ethereum Mainnet"
- The deployer wallet is permanently the contract admin — keep its private key accessible
- `process.env` variables can be silently blocked by shell extensions — have a hardcode fallback ready
- Use Alchemy's RPC URL over free public endpoints — reliability matters for debugging
