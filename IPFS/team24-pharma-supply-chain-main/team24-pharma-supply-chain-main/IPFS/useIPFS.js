/**
 * useIPFS.js
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook wrapping ipfsService for use in components.
 * Tracks loading / error state per operation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import {
  uploadMetadata,
  uploadFile,
  fetchMetadata,
  gatewayURL,
  buildBatchMetadata,
  buildTransferDocument,
} from "../utils/ipfsService";

export default function useIPFS() {
  const [uploading, setUploading]   = useState(false);
  const [fetching,  setFetching]    = useState(false);
  const [error,     setError]       = useState(null);

  // ── Upload batch metadata ─────────────────────────────────────────────────

  const uploadBatchMetadata = useCallback(async (params) => {
    setError(null);
    setUploading(true);
    try {
      const meta = buildBatchMetadata(params);
      const cid  = await uploadMetadata(meta, `batch-${params.batchId}`);
      return cid;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Upload transfer document ──────────────────────────────────────────────

  const uploadTransferDoc = useCallback(async (params) => {
    setError(null);
    setUploading(true);
    try {
      const doc = buildTransferDocument(params);
      const cid = await uploadMetadata(doc, `transfer-${params.batchId}`);
      return cid;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Upload arbitrary file ─────────────────────────────────────────────────

  const uploadDocument = useCallback(async (file, docType = "document") => {
    setError(null);
    setUploading(true);
    try {
      const cid = await uploadFile(file, `${docType}-${file.name}`);
      return cid;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Fetch metadata from IPFS ──────────────────────────────────────────────

  const getMetadata = useCallback(async (cid) => {
    if (!cid) return null;
    setError(null);
    setFetching(true);
    try {
      return await fetchMetadata(cid);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setFetching(false);
    }
  }, []);

  return {
    uploading,
    fetching,
    error,
    uploadBatchMetadata,
    uploadTransferDoc,
    uploadDocument,
    getMetadata,
    gatewayURL,
  };
}
