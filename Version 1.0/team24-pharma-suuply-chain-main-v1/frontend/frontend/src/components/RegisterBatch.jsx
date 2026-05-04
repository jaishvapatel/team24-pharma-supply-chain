import React, { useState } from "react";
import { ethers } from "ethers";
import CONTRACT_ABI from "../abi/PharmaceuticalSupplyChain.json";

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0x10B475907bc2DFf7d23646852936E794956c4967";
const PINATA_KEY = process.env.REACT_APP_PINATA_API_KEY || "";
const PINATA_SECRET = process.env.REACT_APP_PINATA_SECRET_KEY || "";
const GATEWAY = process.env.REACT_APP_IPFS_GATEWAY || "https://ipfs.io/ipfs/";

async function uploadToIPFS(data, name) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: PINATA_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
    body: JSON.stringify({ pinataContent: data, pinataMetadata: { name }, pinataOptions: { cidVersion: 1 } }),
  });
  if (!res.ok) throw new Error("IPFS upload failed: " + await res.text());
  const json = await res.json();
  return json.IpfsHash;
}

export default function RegisterBatch() {
  const [form, setForm] = useState({
    batchId: "", drugName: "", manufactureDate: "",
    expiryDate: "", composition: "", storageConditions: "",
    certificationNumber: "", additionalNotes: "",
  });
  const [txStatus, setTxStatus] = useState("");
  const [resultCID, setResultCID] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTxStatus("");
    setResultCID("");
    setUploading(true);

    try {
      if (!window.ethereum) throw new Error("MetaMask not detected. Please install it.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await window.ethereum.request({ method: "eth_requestAccounts" });

// Force switch to Sepolia testnet
try {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });
} catch (switchError) {
  // If Sepolia isn't added to MetaMask yet, add it
  if (switchError.code === 4902) {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0xaa36a7",
        chainName: "Sepolia Testnet",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://rpc.sepolia.org"],
        blockExplorerUrls: ["https://sepolia.etherscan.io"],
      }],
    });
  }
}
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setTxStatus("📤 Uploading metadata to IPFS via Pinata...");

      const metadata = {
        schema: "pharma-batch-v1",
        batchId: form.batchId,
        drugName: form.drugName,
        manufacturer: address,
        manufactureDate: new Date(form.manufactureDate).toISOString(),
        expiryDate: new Date(form.expiryDate).toISOString(),
        composition: form.composition.split(",").map(s => s.trim()).filter(Boolean),
        storageConditions: form.storageConditions,
        certificationNumber: form.certificationNumber,
        additionalNotes: form.additionalNotes,
        createdAt: new Date().toISOString(),
      };

      const metaCID = await uploadToIPFS(metadata, "batch-" + form.batchId);
      setResultCID(metaCID);
      setTxStatus("✅ IPFS upload done! CID: " + metaCID + "\n⛓ Sending to blockchain...");

      const mDate = Math.floor(new Date(form.manufactureDate).getTime() / 1000);
      const eDate = Math.floor(new Date(form.expiryDate).getTime() / 1000);

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.registerBatch(form.batchId, form.drugName, mDate, eDate, metaCID);

      setTxStatus("⏳ Waiting for blockchain confirmation...");
      await tx.wait();
      setTxStatus("🎉 Batch registered on blockchain! TX: " + tx.hash);
    } catch (err) {
      setTxStatus("❌ Error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontWeight: 400, fontSize: 14 };
  const labelStyle = { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 600 };

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Register Drug Batch</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          ["batchId", "Batch ID", "e.g. BATCH-2025-001"],
          ["drugName", "Drug Name", "e.g. Amoxicillin 500mg"],
          ["certificationNumber", "Certification Number", "Optional"],
          ["composition", "Composition (comma-separated)", "e.g. Amoxicillin, Clavulanic Acid"],
          ["storageConditions", "Storage Conditions", "e.g. Store below 25°C"],
          ["additionalNotes", "Additional Notes", "Optional"],
        ].map(([name, label, placeholder]) => (
          <label key={name} style={labelStyle}>{label}
            <input name={name} type="text" placeholder={placeholder}
              value={form[name]} onChange={handleChange} style={inputStyle}
              required={name === "batchId" || name === "drugName"} />
          </label>
        ))}
        <label style={labelStyle}>Manufacture Date
          <input type="date" name="manufactureDate" value={form.manufactureDate}
            onChange={handleChange} style={inputStyle} required />
        </label>
        <label style={labelStyle}>Expiry Date
          <input type="date" name="expiryDate" value={form.expiryDate}
            onChange={handleChange} style={inputStyle} required />
        </label>
        <button type="submit" disabled={uploading}
          style={{ padding: "10px 18px", borderRadius: 6, background: uploading ? "#a5b4fc" : "#4f46e5", color: "#fff", border: "none", fontSize: 15, cursor: "pointer" }}>
          {uploading ? "Processing..." : "Register Batch"}
        </button>
      </form>
      {txStatus && (
        <div style={{ marginTop: 14, padding: 12, background: "#f0f0f0", borderRadius: 6, fontSize: 13, whiteSpace: "pre-line" }}>
          {txStatus}
        </div>
      )}
      {resultCID && (
        <div style={{ marginTop: 10, padding: 12, background: "#ecfdf5", borderRadius: 6, fontSize: 13, wordBreak: "break-all" }}>
          <p><strong>IPFS CID:</strong> {resultCID}</p>
          <a href={GATEWAY + resultCID} target="_blank" rel="noreferrer">View metadata on IPFS ↗</a>
        </div>
      )}
    </div>
  );
}