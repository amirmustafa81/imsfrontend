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

    const tagId = form.printable_tag_id.trim();
    if (!tagId) {
      setError("Printable Tag ID is required before printing.");
      return;
    }

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      })[character] ?? character);

    const assetCode = selectedAsset?.asset_id ?? "No asset selected";
    const serialNumber = selectedAsset?.serial_number || "No serial recorded";
    const frame = document.createElement("iframe");
    frame.setAttribute("title", "IMS tag print");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      frame.remove();
      setError("Unable to prepare tag print preview.");
      return;
    }

    frameDocument.open();
    frameDocument.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(tagId)}</title>
          <style>
            @page { size: 80mm 50mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              width: 80mm;
              height: 50mm;
              margin: 0;
              background: #fff;
              color: #20242a;
              font-family: Arial, Helvetica, sans-serif;
            }
            .label {
              width: 80mm;
              height: 50mm;
              padding: 7mm;
              display: flex;
              align-items: center;
              gap: 5mm;
              border: 1px solid #20242a;
            }
            .qr {
              width: 24mm;
              height: 24mm;
              flex: 0 0 24mm;
              border: 1px solid #dfe3ea;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .text {
              min-width: 0;
              flex: 1;
              line-height: 1.25;
            }
            .tag {
              font-size: 11pt;
              font-weight: 700;
              overflow-wrap: anywhere;
            }
            .meta {
              margin-top: 2mm;
              color: #4f5865;
              font-size: 9pt;
              overflow-wrap: anywhere;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 64 64" role="img" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" fill="#fff"/>
                <path fill="#20242a" d="M6 6h18v18H6zM10 10v10h10V10H10zm30-4h18v18H40zM44 10v10h10V10H44zM6 40h18v18H6zM10 44v10h10V44H10zm24-34h4v8h-4zM30 22h8v4h-8zM26 30h8v4h-8zM38 30h4v8h-4zM46 28h12v4H46zM46 36h4v8h-4zM54 36h4v4h-4zM30 42h8v4h-8zM42 46h16v4H42zM30 52h4v6h-4zM38 54h8v4h-8zM50 54h8v4h-8zM26 10h4v4h-4zM26 18h4v4h-4zM10 30h10v4H10z"/>
              </svg>
            </div>
            <div class="text">
              <div class="tag">${escapeHtml(tagId)}</div>
              <div class="meta">${escapeHtml(assetCode)}</div>
              <div class="meta">${escapeHtml(serialNumber)}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    frameDocument.close();

    frameWindow.onafterprint = () => frame.remove();
    window.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 100);
  }, [form.printable_tag_id, selectedAsset]);

  const selectLogForPrinting = useCallback((row: TagPrintLog) => {
    const format = row.print_format?.toLowerCase() ?? "";
    const normalizedFormat = format.includes("qr") && format.includes("barcode")
      ? "COMBINED"
      : format.includes("barcode")
        ? "BARCODE"
        : format.includes("qr")
          ? "QR"
          : "";

    setForm({
      asset_id: String(row.asset_id),
      printable_tag_id: row.printable_tag_id,
      print_format: normalizedFormat,
      remarks: row.remarks ?? "",
    });
    setAssetFilterId(row.asset_id);
    setMessage(`Selected ${row.asset?.asset_id ?? row.printable_tag_id} for printing.`);
    setError("");
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
                    <div className="border rounded bg-light p-3 ims-tag-print-area">
                      <div className="small text-secondary mb-2">Tag Preview</div>
                      <div className="d-flex align-items-center gap-3 ims-tag-print-label">
                        <div className="border bg-white d-flex align-items-center justify-content-center ims-tag-qr-box">
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
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteLog(row.id);
                      }}
                    >
                      <i className="bi bi-trash me-1" />
                      Delete
                    </button>
                  ),
                },
              ]}
              rows={rows}
              empty="No print logs found."
              rowClassName={() => "cursor-pointer"}
              onRowClick={(row) => selectLogForPrinting(row)}
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
