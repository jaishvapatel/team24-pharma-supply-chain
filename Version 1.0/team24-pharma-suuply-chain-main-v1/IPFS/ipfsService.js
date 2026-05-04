/**
 * ipfsService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Team 24 – Pharma Supply Chain  |  IPFS Off-chain Storage Layer
 *
 * Strategy:
 *   1. Try Pinata (cloud pinning) first – works in production / CI.
 *   2. Fall back to a local Kubo node (http://localhost:5001) for dev.
 *
 * Environment variables (create a .env in the project root):
 *   REACT_APP_PINATA_API_KEY=<your key>
 *   REACT_APP_PINATA_SECRET_KEY=<your secret>
 *   REACT_APP_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/  (optional)
 *   REACT_APP_LOCAL_IPFS=http://localhost:5001                  (optional)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PINATA_BASE    = "https://api.pinata.cloud";
const DEFAULT_GW     = process.env.REACT_APP_IPFS_GATEWAY  || "https://ipfs.io/ipfs/";
const LOCAL_IPFS     = process.env.REACT_APP_LOCAL_IPFS    || "http://localhost:5001";
const PINATA_KEY     = process.env.REACT_APP_PINATA_API_KEY    || "";
const PINATA_SECRET  = process.env.REACT_APP_PINATA_SECRET_KEY || "";

// ─── helpers ──────────────────────────────────────────────────────────────────

const pinataHeaders = () => ({
  "pinata_api_key":        PINATA_KEY,
  "pinata_secret_api_key": PINATA_SECRET,
});

const usePinata = () => PINATA_KEY.length > 0 && PINATA_SECRET.length > 0;

// ─── Upload JSON metadata ─────────────────────────────────────────────────────

/**
 * Upload a plain JS object as JSON to IPFS.
 * Returns the CID string.
 *
 * @param {object} metadata   - Any JSON-serialisable object
 * @param {string} name       - Optional descriptive name shown in Pinata dashboard
 * @returns {Promise<string>} CID
 */
export async function uploadMetadata(metadata, name = "batch-metadata") {
  if (usePinata()) {
    return _pinataUploadJSON(metadata, name);
  }
  return _localUploadJSON(metadata);
}

// ─── Upload File (PDF, image, etc.) ──────────────────────────────────────────

/**
 * Upload a File / Blob to IPFS.
 * Returns the CID string.
 *
 * @param {File|Blob} file
 * @param {string}    name  - Filename hint
 * @returns {Promise<string>} CID
 */
export async function uploadFile(file, name) {
  const fileName = name || file.name || "document";
  if (usePinata()) {
    return _pinataUploadFile(file, fileName);
  }
  return _localUploadFile(file);
}

// ─── Fetch / retrieve from IPFS ──────────────────────────────────────────────

/**
 * Fetch JSON metadata from IPFS by CID.
 * Tries multiple public gateways for resilience.
 *
 * @param {string} cid
 * @returns {Promise<object>} parsed JSON
 */
export async function fetchMetadata(cid) {
  const gateways = [
    DEFAULT_GW,
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/",
    "https://ipfs.io/ipfs/",
  ];

  for (const gw of gateways) {
    try {
      const res = await fetch(`${gw}${cid}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return res.json();
    } catch {
      // try next gateway
    }
  }
  throw new Error(`Could not fetch CID ${cid} from any gateway`);
}

/**
 * Return a public URL to access an IPFS resource.
 *
 * @param {string} cid
 * @returns {string}
 */
export function gatewayURL(cid) {
  return `${DEFAULT_GW}${cid}`;
}

// ─── Batch metadata builder ───────────────────────────────────────────────────

/**
 * Build a standardised batch-metadata object to upload.
 *
 * @param {object} params
 * @returns {object}
 */
export function buildBatchMetadata({
  batchId,
  drugName,
  manufacturer,
  manufactureDate,
  expiryDate,
  composition = [],
  storageConditions = "",
  certificationNumber = "",
  additionalNotes = "",
}) {
  return {
    schema:             "pharma-batch-v1",
    batchId,
    drugName,
    manufacturer,
    manufactureDate:    new Date(manufactureDate * 1000).toISOString(),
    expiryDate:         new Date(expiryDate * 1000).toISOString(),
    composition,
    storageConditions,
    certificationNumber,
    additionalNotes,
    createdAt:          new Date().toISOString(),
  };
}

/**
 * Build a transfer document object to upload.
 */
export function buildTransferDocument({
  batchId,
  from,
  to,
  transferDate,
  quantity,
  temperature = null,
  notes = "",
}) {
  return {
    schema:       "pharma-transfer-v1",
    batchId,
    from,
    to,
    transferDate: new Date(transferDate).toISOString(),
    quantity,
    temperature,
    notes,
    createdAt:    new Date().toISOString(),
  };
}

// ─── Pinata internals ─────────────────────────────────────────────────────────

async function _pinataUploadJSON(data, name) {
  const body = JSON.stringify({
    pinataContent:  data,
    pinataMetadata: { name },
    pinataOptions:  { cidVersion: 1 },
  });

  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...pinataHeaders() },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata JSON upload failed: ${err}`);
  }

  const json = await res.json();
  return json.IpfsHash;
}

async function _pinataUploadFile(file, name) {
  const fd = new FormData();
  fd.append("file", file, name);
  fd.append("pinataOptions",  JSON.stringify({ cidVersion: 1 }));
  fd.append("pinataMetadata", JSON.stringify({ name }));

  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method:  "POST",
    headers: pinataHeaders(),   // no Content-Type: FormData sets boundary automatically
    body:    fd,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata file upload failed: ${err}`);
  }

  const json = await res.json();
  return json.IpfsHash;
}

// ─── Local Kubo node internals ────────────────────────────────────────────────

async function _localUploadJSON(data) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  return _localUploadFile(blob);
}

async function _localUploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${LOCAL_IPFS}/api/v0/add?cid-version=1`, {
    method: "POST",
    body:   fd,
  });

  if (!res.ok) throw new Error("Local IPFS upload failed");

  const json = await res.json();
  return json.Hash;
}

// ─── Pin management (Pinata only) ────────────────────────────────────────────

/**
 * List all pins associated with a batch (by batchId metadata filter).
 * Requires Pinata credentials.
 */
export async function listBatchPins(batchId) {
  if (!usePinata()) return [];

  const url = `${PINATA_BASE}/data/pinList?metadata[keyvalues][batchId][value]=${batchId}&metadata[keyvalues][batchId][op]=eq`;
  const res  = await fetch(url, { headers: pinataHeaders() });

  if (!res.ok) return [];
  const json = await res.json();
  return json.rows || [];
}

/**
 * Unpin a CID (e.g. soft-delete a draft).
 */
export async function unpinCID(cid) {
  if (!usePinata()) return;

  await fetch(`${PINATA_BASE}/pinning/unpin/${cid}`, {
    method:  "DELETE",
    headers: pinataHeaders(),
  });
}
