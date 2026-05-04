/**
 * RegisterBatch.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Manufacturer registers a new drug batch:
 *   1. Fills in form fields + uploads COA/lab-report file (optional).
 *   2. Metadata + file are pinned to IPFS → CIDs returned.
 *   3. registerBatch() is called on the smart contract with the metadata CID.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { ethers }           from "ethers";
import useIPFS              from "../hooks/useIPFS";
import CONTRACT_ABI         from "../abi/PharmaceuticalSupplyChain.json";

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";

export default function RegisterBatch() {
  const { uploading, error: ipfsError, uploadBatchMetadata, uploadDocument, gatewayURL } = useIPFS();

  const [form, setForm] = useState({
    batchId:            "",
    drugName:           "",
    manufactureDate:    "",
    expiryDate:         "",
    composition:        "",
    storageConditions:  "",
    certificationNumber:"",
    additionalNotes:    "",
  });

  const [file,       setFile]       = useState(null);
  const [txStatus,   setTxStatus]   = useState("");
  const [resultCID,  setResultCID]  = useState("");
  const [fileCID,    setFileCID]    = useState("");

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleFileChange = (e) => setFile(e.target.files[0] || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTxStatus("");
    setResultCID("");
    setFileCID("");

    try {
      // ── Step 1: Get signer ────────────────────────────────────────────────
      if (!window.ethereum) throw new Error("MetaMask not detected");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const address  = await signer.getAddress();

      setTxStatus("📤 Uploading metadata to IPFS…");

      // ── Step 2: Upload metadata JSON to IPFS ──────────────────────────────
      const metaCID = await uploadBatchMetadata({
        batchId:            form.batchId,
        drugName:           form.drugName,
        manufacturer:       address,
        manufactureDate:    Math.floor(new Date(form.manufactureDate).getTime() / 1000),
        expiryDate:         Math.floor(new Date(form.expiryDate).getTime()      / 1000),
        composition:        form.composition.split(",").map((s) => s.trim()).filter(Boolean),
        storageConditions:  form.storageConditions,
        certificationNumber:form.certificationNumber,
        additionalNotes:    form.additionalNotes,
      });

      setResultCID(metaCID);

      // ── Step 3 (optional): Upload accompanying document ───────────────────
      let docCIDValue = "";
      if (file) {
        setTxStatus("📎 Uploading document to IPFS…");
        docCIDValue = await uploadDocument(file, "lab_report");
        setFileCID(docCIDValue);
      }

      // ── Step 4: Call smart contract ───────────────────────────────────────
      setTxStatus("⛓ Sending transaction to blockchain…");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const mDate = Math.floor(new Date(form.manufactureDate).getTime() / 1000);
      const eDate = Math.floor(new Date(form.expiryDate).getTime()      / 1000);

      const tx = await contract.registerBatch(
        form.batchId,
        form.drugName,
        mDate,
        eDate,
        metaCID
      );

      setTxStatus("⏳ Waiting for confirmation…");
      await tx.wait();

      // ── Step 5 (optional): Attach the file CID to the batch ──────────────
      if (docCIDValue) {
        const tx2 = await contract.attachDocument(form.batchId, docCIDValue, "lab_report");
        await tx2.wait();
      }

      setTxStatus(`✅ Batch registered! TX: ${tx.hash}`);
    } catch (err) {
      console.error(err);
      setTxStatus(`❌ Error: ${err.message}`);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Register Drug Batch</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        {[
          ["batchId",             "Batch ID",              "text",   "e.g. BATCH-2025-001"],
          ["drugName",            "Drug Name",             "text",   "e.g. Amoxicillin 500mg"],
          ["certificationNumber", "Certification Number",  "text",   "Optional"],
          ["composition",         "Composition (comma-separated)", "text", "e.g. Amoxicillin, Clavulanic Acid"],
          ["storageConditions",   "Storage Conditions",    "text",   "e.g. Store below 25°C"],
          ["additionalNotes",     "Additional Notes",      "text",   "Optional"],
        ].map(([name, label, type, placeholder]) => (
          <label key={name} style={styles.label}>
            {label}
            <input
              name={name}
              type={type}
              placeholder={placeholder}
              value={form[name]}
              onChange={handleChange}
              style={styles.input}
              required={name === "batchId" || name === "drugName"}
            />
          </label>
        ))}

        <label style={styles.label}>
          Manufacture Date
          <input
            type="date" name="manufactureDate"
            value={form.manufactureDate}
            onChange={handleChange}
            style={styles.input} required
          />
        </label>

        <label style={styles.label}>
          Expiry Date
          <input
            type="date" name="expiryDate"
            value={form.expiryDate}
            onChange={handleChange}
            style={styles.input} required
          />
        </label>

        <label style={styles.label}>
          Attach Document (PDF / image) — optional
          <input type="file" accept=".pdf,.jpg,.png" onChange={handleFileChange} style={styles.input} />
        </label>

        <button type="submit" style={styles.button} disabled={uploading}>
          {uploading ? "Uploading to IPFS…" : "Register Batch"}
        </button>
      </form>

      {ipfsError && <p style={styles.error}>IPFS error: {ipfsError}</p>}

      {txStatus && <p style={styles.status}>{txStatus}</p>}

      {resultCID && (
        <div style={styles.cidBox}>
          <p><strong>Metadata CID:</strong> {resultCID}</p>
          <a href={gatewayURL(resultCID)} target="_blank" rel="noreferrer">
            View on IPFS ↗
          </a>
        </div>
      )}

      {fileCID && (
        <div style={styles.cidBox}>
          <p><strong>Document CID:</strong> {fileCID}</p>
          <a href={gatewayURL(fileCID)} target="_blank" rel="noreferrer">
            View document ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ── Inline styles (replace with your CSS / Tailwind as needed) ────────────────
const styles = {
  container: { maxWidth: 560, margin: "40px auto", fontFamily: "system-ui, sans-serif" },
  heading:   { fontSize: 22, marginBottom: 20 },
  form:      { display: "flex", flexDirection: "column", gap: 14 },
  label:     { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 600 },
  input:     { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, fontWeight: 400 },
  button:    { padding: "10px 18px", borderRadius: 6, background: "#4f46e5", color: "#fff", border: "none",
               fontSize: 15, cursor: "pointer", marginTop: 6 },
  status:    { marginTop: 14, padding: 12, background: "#f0f0f0", borderRadius: 6, fontSize: 13 },
  cidBox:    { marginTop: 10, padding: 12, background: "#ecfdf5", borderRadius: 6, fontSize: 13, wordBreak: "break-all" },
  error:     { color: "#dc2626", fontSize: 13 },
};
