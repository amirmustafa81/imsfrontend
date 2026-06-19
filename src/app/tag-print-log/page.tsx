"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type AssetOption = {
  id: number;
  asset_id: string;
  serial_number: string;
};

type TagPrintLog = {
  id: number;
  asset_id: number;
  printable_tag_id: string;
  print_format: string | null;
  printed_at: string | null;
  remarks: string | null;
  printed_by: {
    name: string;
  };
  created_at: string;
  asset: {
    asset_id: string;
    serial_number: string;
  };
};

type TagPrintForm = {
  asset_id: string;
  printable_tag_id: string;
  print_format: string;
  remarks: string;
};

const printFormatOptions = [
  { value: "", label: "Default" },
  { value: "QR", label: "QR" },
  { value: "BARCODE", label: "Barcode" },
  { value: "COMBINED", label: "QR + Barcode" },
];

export default function TagPrintLogPage() {
  return (
    <Suspense fallback={<main className="p-4 text-secondary">Loading tag print log...</main>}>
      <TagPrintLogContent />
    </Suspense>
  );
}

function TagPrintLogContent() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rows, setRows] = useState<TagPrintLog[]>([]);
  const [search, setSearch] = useState("");
  const [assetFilterId, setAssetFilterId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TagPrintForm>({
    asset_id: "",
    printable_tag_id: "",
    print_format: "",
    remarks: "",
  });
  const [message, setMessage] = useState("");

  const prefillAssetId = useMemo(() => Number(searchParams.get("asset_id") ?? ""), [searchParams]);
  const prefillAssetCode = searchParams.get("asset_code") || "";
  const prefillSuggestedTag = searchParams.get("suggested_tag") || "";
  const selectedAsset = useMemo(
    () => assets.find((asset) => String(asset.id) === form.asset_id) ?? null,
    [assets, form.asset_id],
  );
  const suggestedTag = useMemo(() => {
    if (!selectedAsset) return "";
    return `${selectedAsset.asset_id || `FA-${selectedAsset.id}`}-TAG`;
  }, [selectedAsset]);

  const loadLookups = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    try {
      const response = await api.get<{ data: AssetOption[] }>("/assets");
      setAssets(response.data.data ?? []);
    } catch {
      setError("Unable to load asset list for tagging.");
    }
  }, [authLoading, isAuthenticated]);

  const loadRows = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ data: TagPrintLog[] }>(
        "/asset-tag-print-logs",
        {
          params: assetFilterId
            ? { asset_id: assetFilterId }
            : search.trim()
              ? { searchable_tag_id: search.trim() }
              : undefined,
        },
      );
      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load tag print log list.");
    } finally {
      setLoading(false);
    }
  }, [assetFilterId, authLoading, isAuthenticated, search]);

  const applyPrefillFromQuery = useCallback(() => {
    if (prefillAssetId > 0) {
      const matchedAsset = assets.find((asset) => asset.id === prefillAssetId);

      setForm((current) => {
        const nextAssetId = matchedAsset?.id ? String(matchedAsset.id) : current.asset_id;
        const nextPrintableTagId = prefillSuggestedTag || current.printable_tag_id;

        return {
          ...current,
          asset_id: nextAssetId,
          printable_tag_id: nextPrintableTagId,
          remarks: current.remarks || (matchedAsset ? `Tag print entry for ${matchedAsset.asset_id}` : current.remarks),
        };
      });

      if (prefillAssetId > 0) {
        setAssetFilterId(prefillAssetId);
      }

      return;
    }

    if (!form.asset_id && prefillAssetCode) {
      const matchedAsset = assets.find((asset) => asset.asset_id === prefillAssetCode);
      if (matchedAsset) {
        setForm((current) => ({
          ...current,
          asset_id: String(matchedAsset.id),
        }));
      }
    }
  }, [assets, form.asset_id, prefillAssetCode, prefillAssetId, prefillSuggestedTag]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyPrefillFromQuery();
  }, [applyPrefillFromQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const setField = useCallback((field: keyof TagPrintForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const selectAsset = useCallback((assetId: string) => {
    const nextAsset = assets.find((asset) => String(asset.id) === assetId);
    setForm((current) => ({
      ...current,
      asset_id: assetId,
      printable_tag_id: current.printable_tag_id || (nextAsset ? `${nextAsset.asset_id || `FA-${nextAsset.id}`}-TAG` : ""),
    }));
  }, [assets]);

  const printCurrentTag = useCallback(() => {
    if (typeof window === "undefined") return;
    window.print();
  }, []);

  const saveLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authLoading || !isAuthenticated) {
      setError("Please log in before saving print logs.");
      return;
    }

    setError("");
    setMessage("");

    if (!assets.some((asset) => String(asset.id) === form.asset_id)) {
      setError("Please choose a valid asset before saving the print log.");
      return;
    }

    if (!form.printable_tag_id.trim()) {
      setError("Printable Tag ID is required before saving or printing.");
      return;
    }

    try {
      await api.post("/asset-tag-print-logs", form);
      await loadRows();
      setMessage("Tag print log saved.");
      setForm({
        asset_id: "",
        printable_tag_id: "",
        print_format: "",
        remarks: "",
      });
    } catch {
      setError("Unable to save tag print log. Verify required fields.");
    }
  };

  const deleteLog = async (logId: number) => {
    if (authLoading || !isAuthenticated) {
      setError("Please log in before deleting print logs.");
      return;
    }

    try {
      await api.delete(`/asset-tag-print-logs/${logId}`);
      await loadRows();
      setMessage("Tag print log removed.");
    } catch {
      setError("Unable to delete print log.");
    }
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Tag Print Log"
          subtitle="Record tag printing actions per asset and export traceability."
        />

        {!isAuthenticated && !authLoading ? (
          <div className="alert alert-info mb-3">
            <i className="bi bi-shield-lock me-2" />
            Log in to load assets and manage tag print history.
          </div>
        ) : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">New Print Record</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={saveLog}>
                  <div className="col-12">
                    <label className="form-label small mb-1">Asset</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.asset_id}
                      onChange={(event) => selectAsset(event.target.value)}
                      required
                    >
                      <option value="">Choose asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.asset_id} — {asset.serial_number || "No serial"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">Printable Tag ID</label>
                    <div className="input-group input-group-sm">
                      <input
                        className="form-control"
                        value={form.printable_tag_id}
                        onChange={(event) => setField("printable_tag_id", event.target.value)}
                        required
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        disabled={!suggestedTag}
                        onClick={() => setField("printable_tag_id", suggestedTag)}
                      >
                        Use Suggested
                      </button>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">Print Format</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.print_format}
                      onChange={(event) => setField("print_format", event.target.value)}
                    >
                      {printFormatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">Remarks</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      value={form.remarks}
                      onChange={(event) => setField("remarks", event.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <div className="border rounded bg-light p-3">
                      <div className="small text-secondary mb-2">Tag Preview</div>
                      <div className="d-flex align-items-center gap-3">
                        <div className="border bg-white d-flex align-items-center justify-content-center" style={{ width: 84, height: 84 }}>
                          <i className="bi bi-qr-code fs-1 text-dark" />
                        </div>
                        <div className="min-w-0">
                          <div className="fw-semibold text-truncate">{form.printable_tag_id || "Select asset to generate tag"}</div>
                          <div className="small text-secondary text-truncate">{selectedAsset?.asset_id ?? "No asset selected"}</div>
                          <div className="small text-secondary text-truncate">{selectedAsset?.serial_number || "No serial recorded"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary me-2" type="submit" disabled={!form.asset_id || !form.printable_tag_id}>
                      <i className="bi bi-printer me-1" />
                      Save Print Log
                    </button>
                    <button className="btn btn-sm btn-outline-primary" type="button" disabled={!form.asset_id || !form.printable_tag_id} onClick={printCurrentTag}>
                      <i className="bi bi-printer-fill me-1" />
                      Print Tag
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => {
              setSearch("");
              setAssetFilterId(0);
            }}>
              <div className="col-12 col-lg-8">
                <label className="form-label small mb-1">Search</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="Search tag id or asset serial"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </FilterBar>
            {assetFilterId ? <div className="text-secondary small mb-2">Showing logs for selected asset ID: {assetFilterId}</div> : null}

            <DataTable
              columns={[
                { key: "asset", header: "Asset", render: (row: TagPrintLog) => row.asset?.asset_id ?? "-" },
                { key: "printable_tag_id", header: "Tag ID" },
                { key: "print_format", header: "Format" },
                { key: "printed_at", header: "Printed At" },
                { key: "printed_by", header: "Printed By", render: (row: TagPrintLog) => row.printed_by?.name ?? "System" },
                {
                  key: "created_at",
                  header: "Status",
                  render: () => <StatusBadge status="Posted" />,
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row: TagPrintLog) => (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => void deleteLog(row.id)}
                    >
                      <i className="bi bi-trash me-1" />
                      Delete
                    </button>
                  ),
                },
              ]}
              rows={rows}
              empty="No print logs found."
            />
          </div>
        </div>

        {message ? <div className="alert alert-success mt-2">{message}</div> : null}
        {error ? <div className="alert alert-danger mt-2">{error}</div> : null}
        {loading ? <span className="small text-secondary">Loading…</span> : null}
      </div>
    </main>
  );
}
