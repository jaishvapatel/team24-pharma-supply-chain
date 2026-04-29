/**
 * BatchViewer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only view of a batch.
 * Reads on-chain state → resolves all IPFS CIDs → renders full history.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { ethers }           from "ethers";
import useIPFS              from "../hooks/useIPFS";
import CONTRACT_ABI         from "../abi/PharmaceuticalSupplyChain.json";

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";
const RPC_URL          = process.env.REACT_APP_RPC_URL          || "https://rpc.sepolia.org";

const ROLE_LABELS = ["None", "Manufacturer", "Distributor", "Pharmacy", "Regulator", "Consumer"];

export default function BatchViewer() {
  const { fetching, error: ipfsError, getMetadata, gatewayURL } = useIPFS();

  const [batchId,   setBatchId]   = useState("");
  const [batchData, setBatchData] = useState(null);
  const [metadata,  setMetadata]  = useState(null);
  const [history,   setHistory]   = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  // ── Fetch everything ───────────────────────────────────────────────────────

  const handleLookup = async () => {
    if (!batchId.trim()) return;
    setLoading(true);
    setError("");
    setBatchData(null);
    setMetadata(null);
    setHistory([]);
    setDocuments([]);

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      // ── On-chain batch summary ────────────────────────────────────────────
      const raw = await contract.getBatch(batchId);
      const summary = {
        drugName:       raw[0],
        manufactureDate:Number(raw[1]),
        expiryDate:     Number(raw[2]),
        currentOwner:   raw[3],
        isVerified:     raw[4],
        metadataCID:    raw[5],
        documentCount:  Number(raw[6]),
      };
      setBatchData(summary);

      // ── Fetch IPFS metadata ───────────────────────────────────────────────
      if (summary.metadataCID) {
        try {
          const meta = await getMetadata(summary.metadataCID);
          setMetadata(meta);
        } catch {
          // non-fatal
        }
      }

      // ── On-chain history ──────────────────────────────────────────────────
      const hist = await contract.getHistory(batchId);
      setHistory(hist.map((h) => ({
        from:      h.from,
        to:        h.to,
        timestamp: Number(h.timestamp),
        action:    h.action,
        ipfsCID:   h.ipfsCID,
      })));

      // ── Attached documents ────────────────────────────────────────────────
      const docs = [];
      for (let i = 0; i < summary.documentCount; i++) {
        const d = await contract.getDocument(batchId, i);
        docs.push({ ipfsCID: d[0], docType: d[1], uploadedAt: Number(d[2]), uploadedBy: d[3] });
      }
      setDocuments(docs);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Batch Viewer</h2>

      <div style={styles.row}>
        <input
          type="text"
          placeholder="Enter Batch ID"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          style={{ ...styles.input, flex: 1 }}
        />
        <button onClick={handleLookup} style={styles.button} disabled={loading || fetching}>
          {loading || fetching ? "Loading…" : "Lookup"}
        </button>
      </div>

      {(error || ipfsError) && <p style={styles.error}>{error || ipfsError}</p>}

      {batchData && (
        <>
          {/* ── Summary ─────────────────────────────────────────────────── */}
          <section style={styles.card}>
            <h3 style={styles.sectionTitle}>On-Chain Summary</h3>
            <Grid>
              <KV label="Drug Name"      value={batchData.drugName} />
              <KV label="Current Owner"  value={batchData.currentOwner} mono />
              <KV label="Manufacture"    value={ts(batchData.manufactureDate)} />
              <KV label="Expiry"         value={ts(batchData.expiryDate)} />
              <KV label="Verified"       value={batchData.isVerified ? "✅ Yes" : "⏳ No"} />
              <KV label="Metadata CID"   value={batchData.metadataCID} mono link={gatewayURL(batchData.metadataCID)} />
            </Grid>
          </section>

          {/* ── IPFS Metadata ───────────────────────────────────────────── */}
          {metadata && (
            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>IPFS Metadata</h3>
              <Grid>
                {metadata.composition?.length > 0 &&
                  <KV label="Composition" value={metadata.composition.join(", ")} />}
                {metadata.storageConditions &&
                  <KV label="Storage"    value={metadata.storageConditions} />}
                {metadata.certificationNumber &&
                  <KV label="Cert #"     value={metadata.certificationNumber} />}
                {metadata.additionalNotes &&
                  <KV label="Notes"      value={metadata.additionalNotes} />}
                {metadata.manufacturer &&
                  <KV label="Manufacturer Addr" value={metadata.manufacturer} mono />}
              </Grid>
            </section>
          )}

          {/* ── History ─────────────────────────────────────────────────── */}
          {history.length > 0 && (
            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>Audit Trail</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Action","From","To","Date","Doc"].map((h) =>
                      <th key={h} style={styles.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={i % 2 === 0 ? styles.trEven : {}}>
                      <td style={styles.td}><span style={actionBadge(h.action)}>{h.action}</span></td>
                      <td style={styles.tdMono}>{short(h.from)}</td>
                      <td style={styles.tdMono}>{short(h.to)}</td>
                      <td style={styles.td}>{ts(h.timestamp)}</td>
                      <td style={styles.td}>
                        {h.ipfsCID
                          ? <a href={gatewayURL(h.ipfsCID)} target="_blank" rel="noreferrer">View ↗</a>
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* ── Attached Documents ──────────────────────────────────────── */}
          {documents.length > 0 && (
            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>Attached Documents</h3>
              {documents.map((d, i) => (
                <div key={i} style={styles.docRow}>
                  <span style={styles.docType}>{d.docType}</span>
                  <span style={styles.docMeta}>
                    {ts(d.uploadedAt)} · {short(d.uploadedBy)}
                  </span>
                  <a href={gatewayURL(d.ipfsCID)} target="_blank" rel="noreferrer" style={styles.docLink}>
                    View on IPFS ↗
                  </a>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────
const ts     = (unix) => new Date(unix * 1000).toLocaleDateString();
const short  = (addr) => addr === ethers.ZeroAddress ? "—" : `${addr.slice(0,6)}…${addr.slice(-4)}`;

const Grid = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>
);

const KV = ({ label, value, mono, link }) => (
  <div style={{ fontSize: 13 }}>
    <span style={{ fontWeight: 600, color: "#555" }}>{label}: </span>
    {link
      ? <a href={link} target="_blank" rel="noreferrer" style={{ fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{value}</a>
      : <span style={{ fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    }
  </div>
);

const actionColors = {
  REGISTERED:  "#dcfce7",
  TRANSFERRED: "#dbeafe",
  VERIFIED:    "#fef9c3",
};
const actionBadge = (action) => ({
  background: actionColors[action] || "#f3f4f6",
  padding: "2px 7px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
});

const styles = {
  container:    { maxWidth: 780, margin: "40px auto", fontFamily: "system-ui, sans-serif" },
  heading:      { fontSize: 22, marginBottom: 20 },
  row:          { display: "flex", gap: 10, marginBottom: 20 },
  input:        { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 },
  button:       { padding: "8px 18px", borderRadius: 6, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" },
  card:         { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  error:        { color: "#dc2626", fontSize: 13, marginBottom: 12 },
  table:        { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:           { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #e5e7eb", fontWeight: 600, fontSize: 12 },
  td:           { padding: "6px 8px" },
  tdMono:       { padding: "6px 8px", fontFamily: "monospace", fontSize: 11 },
  trEven:       { background: "#fafafa" },
  docRow:       { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
  docType:      { background: "#e0e7ff", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 11 },
  docMeta:      { color: "#6b7280", flex: 1 },
  docLink:      { color: "#4f46e5" },
};
