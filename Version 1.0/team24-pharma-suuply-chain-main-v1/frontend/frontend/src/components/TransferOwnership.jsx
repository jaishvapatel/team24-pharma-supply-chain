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
  return (await res.json()).IpfsHash;
}

export default function TransferOwnership() {
  const [form, setForm] = useState({ batchId: "", newOwner: "", quantity: "", temperature: "", notes: "" });
  const [txStatus, setTxStatus] = useState("");
  const [docCID, setDocCID] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTxStatus(""); setDocCID(""); setUploading(true);
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setTxStatus("📤 Uploading transfer document to IPFS...");
      const doc = {
        schema: "pharma-transfer-v1",
        batchId: form.batchId,
        from: address,
        to: form.newOwner,
        transferDate: new Date().toISOString(),
        quantity: form.quantity,
        temperature: form.temperature || null,
        notes: form.notes,
      };
      const cid = await uploadToIPFS(doc, "transfer-" + form.batchId);
      setDocCID(cid);

      setTxStatus("⛓ Sending transfer to blockchain...");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.transferOwnership(form.batchId, form.newOwner, cid);
      setTxStatus("⏳ Waiting for confirmation...");
      await tx.wait();
      setTxStatus("🎉 Transfer complete! TX: " + tx.hash);
    } catch (err) {
      setTxStatus("❌ Error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontWeight: 400 };
  const labelStyle = { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 600 };

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Transfer Batch Ownership</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={labelStyle}>Batch ID
          <input name="batchId" type="text" placeholder="BATCH-2025-001"
            value={form.batchId} onChange={handleChange} style={inputStyle} required />
        </label>
        <label style={labelStyle}>New Owner Address
          <input name="newOwner" type="text" placeholder="0x..."
            value={form.newOwner} onChange={handleChange} style={inputStyle} required />
        </label>
        <label style={labelStyle}>Quantity
          <input name="quantity" type="text" placeholder="e.g. 5000 units"
            value={form.quantity} onChange={handleChange} style={inputStyle} />
        </label>
        <label style={labelStyle}>Temperature (°C)
          <input name="temperature" type="number" value={form.temperature} onChange={handleChange} style={inputStyle} />
        </label>
        <label style={labelStyle}>Notes
          <input name="notes" type="text" placeholder="Optional" value={form.notes} onChange={handleChange} style={inputStyle} />
        </label>
        <button type="submit" disabled={uploading}
          style={{ padding: "10px 18px", borderRadius: 6, background: uploading ? "#67e8f9" : "#0891b2", color: "#fff", border: "none", fontSize: 15, cursor: "pointer" }}>
          {uploading ? "Processing..." : "Transfer Ownership"}
        </button>
      </form>
      {txStatus && <p style={{ marginTop: 14, padding: 12, background: "#f0f0f0", borderRadius: 6, fontSize: 13 }}>{txStatus}</p>}
      {docCID && <div style={{ marginTop: 10, padding: 12, background: "#eff6ff", borderRadius: 6, fontSize: 13, wordBreak: "break-all" }}>
        <p><strong>Transfer Doc CID:</strong> {docCID}</p>
        <a href={GATEWAY + docCID} target="_blank" rel="noreferrer">View on IPFS ↗</a>
      </div>}
    </div>
  );
}