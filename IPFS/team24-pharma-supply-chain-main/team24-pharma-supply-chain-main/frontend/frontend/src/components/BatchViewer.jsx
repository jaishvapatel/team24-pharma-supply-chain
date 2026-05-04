import React, { useState } from "react";
import { ethers } from "ethers";
import CONTRACT_ABI from "../abi/PharmaceuticalSupplyChain.json";

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";
const RPC_URL = process.env.REACT_APP_RPC_URL || "https://rpc.sepolia.org";
const GATEWAY = process.env.REACT_APP_IPFS_GATEWAY || "https://ipfs.io/ipfs/";

export default function BatchViewer() {
  const [batchId, setBatchId] = useState("");
  const [batchData, setBatchData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async () => {
    if (!batchId.trim()) return;
    setLoading(true);
    setError("");
    setBatchData(null);
    setMetadata(null);
    setHistory([]);

    try {
      console.log("Connecting to:", CONTRACT_ADDRESS);
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const raw = await contract.getBatch(batchId);
      console.log("Raw result:", raw);

      const summary = {
        drugName:       raw[0],
        manufactureDate: Number(raw[1]),
        expiryDate:     Number(raw[2]),
        currentOwner:   raw[3],
        isVerified:     raw[4],
        metadataCID:    raw[5],
        documentCount:  Number(raw[6]),
      };
      setBatchData(summary);

      if (summary.metadataCID) {
        try {
          const res = await fetch(GATEWAY + summary.metadataCID);
          if (res.ok) setMetadata(await res.json());
        } catch { }
      }

      const hist = await contract.getHistory(batchId);
      setHistory(hist.map(h => ({
        from: h.from, to: h.to,
        timestamp: Number(h.timestamp),
        action: h.action,
        ipfsCID: h.ipfsCID,
      })));

    } catch (err) {
      console.error("Full error:", err);
      setError("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const ts = (unix) => new Date(unix * 1000).toLocaleDateString();
  const short = (addr) =>
    !addr || addr === ethers.ZeroAddress ? "—" : addr.slice(0, 6) + "…" + addr.slice(-4);
  const actionColor = { REGISTERED: "#dcfce7", TRANSFERRED: "#dbeafe", VERIFIED: "#fef9c3" };

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Batch Viewer</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Enter Batch ID e.g. BATCH-2025-001"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
        />
        <button
          onClick={handleLookup}
          disabled={loading}
          style={{ padding: "8px 18px", borderRadius: 6, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" }}
        >
          {loading ? "Loading..." : "Lookup"}
        </button>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

      {batchData && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Batch Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
            <div><strong>Drug:</strong> {batchData.drugName}</div>
            <div><strong>Verified:</strong> {batchData.isVerified ? "✅ Yes" : "⏳ No"}</div>
            <div><strong>Manufacture:</strong> {ts(batchData.manufactureDate)}</div>
            <div><strong>Expiry:</strong> {ts(batchData.expiryDate)}</div>
            <div style={{ gridColumn: "1/-1" }}>
              <strong>Owner:</strong> <code style={{ fontSize: 11 }}>{batchData.currentOwner}</code>
            </div>
            {batchData.metadataCID && (
              <div style={{ gridColumn: "1/-1" }}>
                <strong>IPFS CID:</strong>{" "}
                <a href={GATEWAY + batchData.metadataCID} target="_blank" rel="noreferrer"
                  style={{ wordBreak: "break-all", fontSize: 11 }}>
                  {batchData.metadataCID}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {metadata && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>IPFS Metadata</h3>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            {metadata.composition?.length > 0 &&
              <div><strong>Composition:</strong> {metadata.composition.join(", ")}</div>}
            {metadata.storageConditions &&
              <div><strong>Storage:</strong> {metadata.storageConditions}</div>}
            {metadata.certificationNumber &&
              <div><strong>Cert #:</strong> {metadata.certificationNumber}</div>}
            {metadata.additionalNotes &&
              <div><strong>Notes:</strong> {metadata.additionalNotes}</div>}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Audit Trail</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Action", "From", "To", "Date", "Doc"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #e5e7eb", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ background: actionColor[h.action] || "#f3f4f6", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {h.action}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{short(h.from)}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{short(h.to)}</td>
                  <td style={{ padding: "6px 8px" }}>{ts(h.timestamp)}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {h.ipfsCID
                      ? <a href={GATEWAY + h.ipfsCID} target="_blank" rel="noreferrer">View ↗</a>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}