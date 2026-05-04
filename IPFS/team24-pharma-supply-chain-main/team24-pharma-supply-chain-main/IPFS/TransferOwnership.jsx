/**
 * TransferOwnership.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Transfers a batch to a new stakeholder.
 * Optionally uploads a transfer document (shipping manifest / invoice) to IPFS
 * and stores the CID on-chain via transferOwnership().
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { ethers }           from "ethers";
import useIPFS              from "../hooks/useIPFS";
import CONTRACT_ABI         from "../abi/PharmaceuticalSupplyChain.json";

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";

export default function TransferOwnership() {
  const { uploading, error: ipfsError, uploadTransferDoc, uploadDocument, gatewayURL } = useIPFS();

  const [form, setForm] = useState({
    batchId:      "",
    newOwner:     "",
    quantity:     "",
    temperature:  "",
    notes:        "",
  });

  const [file,     setFile]     = useState(null);
  const [txStatus, setTxStatus] = useState("");
  const [docCID,   setDocCID]   = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTxStatus("");
    setDocCID("");

    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const address  = await signer.getAddress();

      let transferCID = "";

      // ── Step 1: Build & upload transfer doc to IPFS ───────────────────────
      setTxStatus("📤 Uploading transfer document to IPFS…");

      if (file) {
        // Prefer an actual file if provided
        transferCID = await uploadDocument(file, "transfer_doc");
      } else {
        // Build a JSON transfer document
        transferCID = await uploadTransferDoc({
          batchId:      form.batchId,
          from:         address,
          to:           form.newOwner,
          transferDate: Date.now(),
          quantity:     form.quantity,
          temperature:  form.temperature || null,
          notes:        form.notes,
        });
      }

      setDocCID(transferCID);

      // ── Step 2: Call transferOwnership on contract ────────────────────────
      setTxStatus("⛓ Sending transfer transaction…");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.transferOwnership(form.batchId, form.newOwner, transferCID);

      setTxStatus("⏳ Waiting for confirmation…");
      await tx.wait();

      setTxStatus(`✅ Transfer complete! TX: ${tx.hash}`);
    } catch (err) {
      console.error(err);
      setTxStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Transfer Batch Ownership</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Batch ID
          <input
            name="batchId" type="text" placeholder="BATCH-2025-001"
            value={form.batchId} onChange={handleChange}
            style={styles.input} required
          />
        </label>

        <label style={styles.label}>
          New Owner Address
          <input
            name="newOwner" type="text" placeholder="0x..."
            value={form.newOwner} onChange={handleChange}
            style={styles.input} required
          />
        </label>

        <label style={styles.label}>
          Quantity
          <input
            name="quantity" type="text" placeholder="e.g. 5000 units"
            value={form.quantity} onChange={handleChange}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Storage Temperature (°C)
          <input
            name="temperature" type="number"
            value={form.temperature} onChange={handleChange}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Notes
          <input
            name="notes" type="text" placeholder="Optional transfer notes"
            value={form.notes} onChange={handleChange}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Upload Shipping Document (optional — overrides JSON doc)
          <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setFile(e.target.files[0])} style={styles.input} />
        </label>

        <button type="submit" style={styles.button} disabled={uploading}>
          {uploading ? "Uploading…" : "Transfer Ownership"}
        </button>
      </form>

      {ipfsError && <p style={styles.error}>IPFS error: {ipfsError}</p>}
      {txStatus   && <p style={styles.status}>{txStatus}</p>}

      {docCID && (
        <div style={styles.cidBox}>
          <p><strong>Transfer Document CID:</strong> {docCID}</p>
          <a href={gatewayURL(docCID)} target="_blank" rel="noreferrer">
            View on IPFS ↗
          </a>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 520, margin: "40px auto", fontFamily: "system-ui, sans-serif" },
  heading:   { fontSize: 22, marginBottom: 20 },
  form:      { display: "flex", flexDirection: "column", gap: 14 },
  label:     { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 600 },
  input:     { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, fontWeight: 400 },
  button:    { padding: "10px 18px", borderRadius: 6, background: "#0891b2", color: "#fff", border: "none",
               fontSize: 15, cursor: "pointer", marginTop: 6 },
  status:    { marginTop: 14, padding: 12, background: "#f0f0f0", borderRadius: 6, fontSize: 13 },
  cidBox:    { marginTop: 10, padding: 12, background: "#eff6ff", borderRadius: 6, fontSize: 13, wordBreak: "break-all" },
  error:     { color: "#dc2626", fontSize: 13 },
};
