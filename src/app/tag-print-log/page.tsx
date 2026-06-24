"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
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

type NormalizedPrintFormat = "QR" | "BARCODE" | "COMBINED";

const normalizePrintFormat = (format: string | null | undefined): NormalizedPrintFormat => {
  const normalized = (format ?? "").toLowerCase();

  if (normalized.includes("qr") && normalized.includes("barcode")) return "COMBINED";
  if (normalized.includes("barcode")) return "BARCODE";
  if (normalized.includes("qr")) return "QR";

  return "QR";
};

const barcodeSvgMarkup = `
  <svg width="128" height="48" viewBox="0 0 128 48" role="img" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="48" fill="#fff"/>
    <path fill="#20242a" d="M4 4h2v40H4zM9 4h4v40H9zM16 4h2v40h-2zM22 4h6v40h-6zM32 4h2v40h-2zM38 4h4v40h-4zM46 4h2v40h-2zM52 4h8v40h-8zM64 4h2v40h-2zM70 4h4v40h-4zM78 4h2v40h-2zM84 4h6v40h-6zM94 4h2v40h-2zM101 4h4v40h-4zM110 4h2v40h-2zM116 4h8v40h-8z"/>
  </svg>
`;

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
  const [qrDataUrl, setQrDataUrl] = useState("");

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
  const selectedPrintFormat = normalizePrintFormat(form.print_format);
  const qrPayload = useMemo(() => {
    if (typeof window === "undefined" || !form.asset_id) {
      return "";
    }

    return new URL(`/assets/${form.asset_id}`, window.location.origin).toString();
  }, [form.asset_id]);

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

  useEffect(() => {
    const qrValue = qrPayload.trim();

    if (!qrValue || selectedPrintFormat === "BARCODE") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrDataUrl("");
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(qrValue, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#20242a",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (isMounted) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (isMounted) setQrDataUrl("");
      });

    return () => {
      isMounted = false;
    };
  }, [qrPayload, selectedPrintFormat]);

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
    const qrImageMarkup = qrDataUrl
      ? `<img src="${escapeHtml(qrDataUrl)}" alt="QR code for ${escapeHtml(tagId)}" />`
      : `<span class="unavailable">QR unavailable</span>`;
    const visualMarkup = selectedPrintFormat === "BARCODE"
      ? `<div class="barcode" aria-hidden="true">${barcodeSvgMarkup}</div>`
      : selectedPrintFormat === "COMBINED"
        ? `<div class="combined"><div class="qr">${qrImageMarkup}</div><div class="barcode" aria-hidden="true">${barcodeSvgMarkup}</div></div>`
        : `<div class="qr">${qrImageMarkup}</div>`;
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
            .qr img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .unavailable {
              color: #9a1f2b;
              font-size: 7pt;
              text-align: center;
            }
            .barcode {
              width: 36mm;
              height: 18mm;
              flex: 0 0 36mm;
              border: 1px solid #dfe3ea;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
            }
            .barcode svg {
              width: 32mm;
              height: 12mm;
            }
            .combined {
              width: 28mm;
              flex: 0 0 28mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 2mm;
            }
            .combined .qr {
              width: 20mm;
              height: 20mm;
              flex: 0 0 20mm;
            }
            .combined .qr svg {
              width: 17mm;
              height: 17mm;
            }
            .combined .qr img {
              width: 17mm;
              height: 17mm;
            }
            .combined .barcode {
              width: 28mm;
              height: 10mm;
              flex: 0 0 10mm;
            }
            .combined .barcode svg {
              width: 25mm;
              height: 7mm;
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
            ${visualMarkup}
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
  }, [form.printable_tag_id, qrDataUrl, selectedAsset, selectedPrintFormat]);

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
                        {selectedPrintFormat === "BARCODE" ? (
                          <div className="border bg-white d-flex align-items-center justify-content-center ims-tag-barcode-box">
                            <span className="ims-barcode-preview" aria-hidden="true" />
                          </div>
                        ) : selectedPrintFormat === "COMBINED" ? (
                          <div className="d-flex flex-column align-items-center gap-2">
                            <div className="border bg-white d-flex align-items-center justify-content-center ims-tag-qr-box ims-tag-qr-box-sm">
                              {qrDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className="ims-qr-preview-img" src={qrDataUrl} alt={`QR code for ${form.printable_tag_id}`} />
                              ) : (
                                <span className="small text-secondary text-center">QR</span>
                              )}
                            </div>
                            <div className="border bg-white d-flex align-items-center justify-content-center ims-tag-barcode-box ims-tag-barcode-box-sm">
                              <span className="ims-barcode-preview ims-barcode-preview-sm" aria-hidden="true" />
                            </div>
                          </div>
                        ) : (
                          <div className="border bg-white d-flex align-items-center justify-content-center ims-tag-qr-box">
                            {qrDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img className="ims-qr-preview-img" src={qrDataUrl} alt={`QR code for ${form.printable_tag_id}`} />
                            ) : (
                              <span className="small text-secondary text-center">QR</span>
                            )}
                          </div>
                        )}
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
