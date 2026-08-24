"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { createCode128SvgMarkup } from "@/lib/barcode";
import { useAuth } from "@/lib/auth";
import { DataTable, FieldLabel, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type AssetOption = {
  id: number;
  asset_id: string;
  serial_number: string | null;
  printable_tag_id?: string | null;
  department?: {
    code?: string | null;
    name?: string | null;
  } | null;
  building?: {
    code?: string | null;
    name?: string | null;
  } | null;
  room?: {
    code?: string | null;
    name?: string | null;
  } | null;
  store?: {
    code?: string | null;
    name?: string | null;
  } | null;
  department_code?: string | null;
  building_code?: string | null;
  room_code?: string | null;
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

const tagPrintFieldInfo = {
  asset: "Choose the asset whose physical barcode or QR tag is being generated.",
  printableTag: "Final tag text encoded in the printed QR/barcode and shown on the physical label.",
  printFormat: "Controls whether the label prints QR only, barcode only, or both.",
  remarks: "Optional note explaining why the tag was printed or reprinted.",
};

type NormalizedPrintFormat = "QR" | "BARCODE" | "COMBINED";

const normalizePrintFormat = (format: string | null | undefined): NormalizedPrintFormat => {
  const normalized = (format ?? "").toLowerCase();

  if (normalized.includes("qr") && normalized.includes("barcode")) return "COMBINED";
  if (normalized.includes("barcode")) return "BARCODE";
  if (normalized.includes("qr")) return "QR";

  return "QR";
};

const svgToDataUrl = (svgMarkup: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;

const relationLabel = (relation?: { code?: string | null; name?: string | null } | null, fallback?: string | null) =>
  relation?.name || relation?.code || fallback || "";

const assetLocationLabel = (asset: AssetOption | null) => {
  if (!asset) {
    return "No location selected";
  }

  const building = relationLabel(asset.building, asset.building_code);
  const room = relationLabel(asset.room, asset.room_code);
  const store = relationLabel(asset.store);
  const department = relationLabel(asset.department, asset.department_code);
  const buildingRoom = [building, room].filter(Boolean).join(" / ");

  return buildingRoom || store || department || "No location recorded";
};

const mergeAssetOptions = (baseAssets: AssetOption[], extraAssets: AssetOption[]) => {
  const merged = new Map<number, AssetOption>();
  baseAssets.forEach((asset) => merged.set(asset.id, asset));
  extraAssets.forEach((asset) => merged.set(asset.id, asset));
  return Array.from(merged.values());
};

const MAX_ASSET_OPTIONS = 100;

const createPrefillFallbackAsset = (
  assetId: number,
  assetCode: string,
  suggestedTag: string,
  location?: {
    departmentCode?: string;
    departmentName?: string;
    buildingName?: string;
    roomName?: string;
  },
): AssetOption | null => {
  if (assetId <= 0) {
    return null;
  }

  return {
    id: assetId,
    asset_id: assetCode || suggestedTag.replace(/^TAG-/, "") || `FA-${assetId}`,
    serial_number: null,
    printable_tag_id: suggestedTag || null,
    department: location?.departmentCode || location?.departmentName
      ? { code: location.departmentCode || null, name: location.departmentName || null }
      : null,
    building: location?.buildingName ? { name: location.buildingName } : null,
    room: location?.roomName ? { name: location.roomName } : null,
  };
};

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
  const prefillAssetId = Number(searchParams.get("asset_id") ?? "");
  const prefillAssetCode = searchParams.get("asset_code") || "";
  const prefillSuggestedTag = searchParams.get("suggested_tag") || "";
  const prefillDepartmentCode = searchParams.get("department_code") || "";
  const prefillDepartmentName = searchParams.get("department_name") || "";
  const prefillBuildingName = searchParams.get("building_name") || "";
  const prefillRoomName = searchParams.get("room_name") || "";
  const prefillLocation = useMemo(
    () => ({
      departmentCode: prefillDepartmentCode,
      departmentName: prefillDepartmentName,
      buildingName: prefillBuildingName,
      roomName: prefillRoomName,
    }),
    [prefillBuildingName, prefillDepartmentCode, prefillDepartmentName, prefillRoomName],
  );
  const prefillFallbackAsset = useMemo(
    () => createPrefillFallbackAsset(prefillAssetId, prefillAssetCode, prefillSuggestedTag, prefillLocation),
    [prefillAssetCode, prefillAssetId, prefillLocation, prefillSuggestedTag],
  );

  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rows, setRows] = useState<TagPrintLog[]>([]);
  const [search, setSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilterId, setAssetFilterId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TagPrintForm>({
    asset_id: prefillAssetId > 0 ? String(prefillAssetId) : "",
    printable_tag_id: prefillSuggestedTag,
    print_format: "",
    remarks: prefillAssetCode ? `Tag print entry for ${prefillAssetCode}` : "",
  });
  const [message, setMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const selectedAsset = useMemo(
    () =>
      assets.find((asset) => String(asset.id) === form.asset_id) ??
      (prefillFallbackAsset && form.asset_id === String(prefillFallbackAsset.id) ? prefillFallbackAsset : null),
    [assets, form.asset_id, prefillFallbackAsset],
  );
  const visibleAssets = useMemo(() => {
    const sourceAssets = prefillFallbackAsset ? mergeAssetOptions(assets, [prefillFallbackAsset]) : assets;
    const limitedAssets = sourceAssets.slice(0, MAX_ASSET_OPTIONS);

    if (!form.asset_id || limitedAssets.some((asset) => String(asset.id) === form.asset_id)) {
      return limitedAssets;
    }

    const selectedOption = sourceAssets.find((asset) => String(asset.id) === form.asset_id);
    return selectedOption ? [...limitedAssets, selectedOption] : limitedAssets;
  }, [assets, form.asset_id, prefillFallbackAsset]);
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
  const barcodeSvgMarkup = useMemo(
    () => createCode128SvgMarkup(form.printable_tag_id, { height: 64, moduleWidth: 2 }),
    [form.printable_tag_id],
  );
  const selectedAssetLocation = useMemo(() => assetLocationLabel(selectedAsset), [selectedAsset]);

  const loadPrefillAsset = useCallback(
    async (loadedAssets: AssetOption[]) => {
      if (!prefillAssetId && !prefillAssetCode && !prefillSuggestedTag) {
        return loadedAssets;
      }

      const fallbackAsset = createPrefillFallbackAsset(prefillAssetId, prefillAssetCode, prefillSuggestedTag, prefillLocation);

      const alreadyLoaded = loadedAssets.some((asset) => {
        if (prefillAssetId > 0 && asset.id === prefillAssetId) return true;
        if (prefillAssetCode && asset.asset_id === prefillAssetCode) return true;
        if (prefillSuggestedTag && asset.printable_tag_id === prefillSuggestedTag) return true;
        return false;
      });

      if (alreadyLoaded) {
        return loadedAssets;
      }

      if (fallbackAsset && (prefillAssetCode || prefillSuggestedTag)) {
        return mergeAssetOptions(loadedAssets, [fallbackAsset]);
      }

      try {
        if (prefillAssetId > 0) {
          const detailResponse = await api.get<{ data: AssetOption }>(`/assets/${prefillAssetId}`);
          const prefillAsset = detailResponse.data.data;

          if (prefillAsset?.id) {
            return mergeAssetOptions(loadedAssets, [prefillAsset]);
          }
        }
      } catch {
        // Search fallback supports deployments where asset detail is not exposed to this page.
      }

      const searchValue = prefillAssetCode || prefillSuggestedTag || (prefillAssetId > 0 ? String(prefillAssetId) : "");

      if (!searchValue) {
        return loadedAssets;
      }

      try {
        const searchResponse = await api.get<{ data: AssetOption[] }>("/assets", {
          params: { search: searchValue },
        });
        const searchedAssets = (searchResponse.data.data ?? []).slice(0, MAX_ASSET_OPTIONS);
        const matchedAsset = searchedAssets.find((asset) => {
          if (prefillAssetId > 0 && asset.id === prefillAssetId) return true;
          if (prefillAssetCode && asset.asset_id === prefillAssetCode) return true;
          if (prefillSuggestedTag && asset.printable_tag_id === prefillSuggestedTag) return true;
          return false;
        });

        if (matchedAsset) {
          return mergeAssetOptions(loadedAssets, [matchedAsset]);
        }

        if (searchedAssets.length > 0) {
          return mergeAssetOptions(loadedAssets, searchedAssets);
        }
      } catch {
        // The URL still contains enough legacy asset context to prefill the form.
      }

      return fallbackAsset ? mergeAssetOptions(loadedAssets, [fallbackAsset]) : loadedAssets;
    },
    [prefillAssetCode, prefillAssetId, prefillLocation, prefillSuggestedTag],
  );

  const loadLookups = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    if (!prefillAssetId && !prefillAssetCode && !prefillSuggestedTag) {
      setAssets([]);
      return;
    }

    setLoadingAssets(true);
    try {
      setAssets(await loadPrefillAsset([]));
    } catch {
      setError("Unable to load asset list for tagging.");
    } finally {
      setLoadingAssets(false);
    }
  }, [authLoading, isAuthenticated, loadPrefillAsset, prefillAssetCode, prefillAssetId, prefillSuggestedTag]);

  const searchAssetOptions = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      setError("Please log in before searching assets.");
      return;
    }

    const query = assetSearch.trim();
    if (!query) {
      setError("Enter an asset code, tag, or serial number to search.");
      return;
    }

    setLoadingAssets(true);
    setError("");

    try {
      const response = await api.get<{ data: AssetOption[] }>("/assets", {
        params: { search: query, per_page: MAX_ASSET_OPTIONS, limit: MAX_ASSET_OPTIONS },
      });
      const nextAssets = (response.data.data ?? []).slice(0, MAX_ASSET_OPTIONS);
      setAssets((currentAssets) => mergeAssetOptions(currentAssets, nextAssets).slice(0, MAX_ASSET_OPTIONS));

      if (nextAssets.length === 0) {
        setError("No assets found for that search.");
      }
    } catch {
      setError("Unable to search assets.");
    } finally {
      setLoadingAssets(false);
    }
  }, [assetSearch, authLoading, isAuthenticated]);

  const loadRows = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    const hasUrlPrefill = prefillAssetId > 0 || Boolean(prefillAssetCode) || Boolean(prefillSuggestedTag);
    if (hasUrlPrefill && !search.trim()) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const effectiveAssetFilterId = assetFilterId || (prefillAssetId > 0 ? prefillAssetId : 0);
      const response = await api.get<{ data: TagPrintLog[] }>(
        "/asset-tag-print-logs",
        {
          params: effectiveAssetFilterId
            ? { asset_id: effectiveAssetFilterId, per_page: 50 }
            : search.trim()
              ? { searchable_tag_id: search.trim(), per_page: 50 }
              : { per_page: 50 },
        },
      );
      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load tag print log list.");
    } finally {
      setLoading(false);
    }
  }, [assetFilterId, authLoading, isAuthenticated, prefillAssetCode, prefillAssetId, prefillSuggestedTag, search]);

  const applyPrefillFromQuery = useCallback(() => {
    if (prefillAssetId > 0) {
      const matchedAsset = assets.find((asset) => {
        if (asset.id === prefillAssetId) return true;
        if (prefillAssetCode && asset.asset_id === prefillAssetCode) return true;
        if (prefillSuggestedTag && asset.printable_tag_id === prefillSuggestedTag) return true;
        return false;
      });

      setForm((current) => {
        const nextAssetId = matchedAsset?.id ? String(matchedAsset.id) : String(prefillAssetId);
        const nextPrintableTagId = prefillSuggestedTag || current.printable_tag_id;
        const nextRemarks = current.remarks || `Tag print entry for ${matchedAsset?.asset_id || prefillAssetCode || nextAssetId}`;

        if (
          current.asset_id === nextAssetId &&
          current.printable_tag_id === nextPrintableTagId &&
          current.remarks === nextRemarks
        ) {
          return current;
        }

        return {
          ...current,
          asset_id: nextAssetId,
          printable_tag_id: nextPrintableTagId,
          remarks: nextRemarks,
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
      .catch(async () => {
        try {
          const svgMarkup = await QRCode.toString(qrValue, {
            type: "svg",
            errorCorrectionLevel: "M",
            margin: 2,
            width: 192,
            color: {
              dark: "#20242a",
              light: "#ffffff",
            },
          });

          if (isMounted) setQrDataUrl(svgToDataUrl(svgMarkup));
        } catch {
          if (isMounted) setQrDataUrl("");
        }
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
    const location = assetLocationLabel(selectedAsset);
    const qrImageMarkup = qrDataUrl
      ? `<img src="${escapeHtml(qrDataUrl)}" alt="QR code for ${escapeHtml(tagId)}" />`
      : `<span class="unavailable">QR unavailable</span>`;
    const barcodeMarkup = barcodeSvgMarkup || `<span class="unavailable">Barcode unavailable</span>`;
    const visualMarkup = selectedPrintFormat === "BARCODE"
      ? `<div class="barcode">${barcodeMarkup}</div>`
      : selectedPrintFormat === "COMBINED"
        ? `<div class="combined"><div class="qr">${qrImageMarkup}</div><div class="barcode">${barcodeMarkup}</div></div>`
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
              font-size: 8.4pt;
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
              <div class="meta">${escapeHtml(location)}</div>
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
  }, [barcodeSvgMarkup, form.printable_tag_id, qrDataUrl, selectedAsset, selectedPrintFormat]);

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

    const isUrlPrefilledAsset = prefillAssetId > 0 && form.asset_id === String(prefillAssetId);
    if (!assets.some((asset) => String(asset.id) === form.asset_id) && !isUrlPrefilledAsset) {
      setError("Please choose a valid asset before saving the print log.");
      return;
    }

    if (!form.printable_tag_id.trim()) {
      setError("Printable Tag ID is required before saving or printing.");
      return;
    }

    try {
      setSavingLog(true);
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
    } finally {
      setSavingLog(false);
    }
  };

  const deleteLog = async (logId: number) => {
    if (authLoading || !isAuthenticated) {
      setError("Please log in before deleting print logs.");
      return;
    }

    try {
      setDeletingLogId(logId);
      await api.delete(`/asset-tag-print-logs/${logId}`);
      await loadRows();
      setMessage("Tag print log removed.");
    } catch {
      setError("Unable to delete print log.");
    } finally {
      setDeletingLogId(null);
    }
  };

  const isInitialLoading = authLoading || loadingAssets;
  const isLogListLoading = isInitialLoading || loading;

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
                    <FieldLabel className="mb-1" info={tagPrintFieldInfo.asset}>Asset</FieldLabel>
                    <div className="input-group input-group-sm mb-2">
                      <input
                        className="form-control"
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void searchAssetOptions();
                          }
                        }}
                        placeholder="Search asset code, tag, or serial"
                        disabled={isInitialLoading}
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        disabled={isInitialLoading || !assetSearch.trim()}
                        onClick={() => void searchAssetOptions()}
                      >
                        Search
                      </button>
                    </div>
                    <select
                      className="form-select form-select-sm"
                      value={form.asset_id}
                      onChange={(event) => selectAsset(event.target.value)}
                      disabled={isInitialLoading}
                      required
                    >
                      <option value="">
                        {isInitialLoading
                          ? "Loading assets..."
                          : visibleAssets.length > 0
                            ? "Choose asset"
                            : "Search asset to choose"}
                      </option>
                      {visibleAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.asset_id} — {asset.serial_number || "No serial"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <FieldLabel className="mb-1" info={tagPrintFieldInfo.printableTag}>Printable Tag ID</FieldLabel>
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
                    <FieldLabel className="mb-1" info={tagPrintFieldInfo.printFormat}>Print Format</FieldLabel>
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
                    <FieldLabel className="mb-1" info={tagPrintFieldInfo.remarks}>Remarks</FieldLabel>
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
                            {barcodeSvgMarkup ? (
                              <span className="ims-barcode-preview" dangerouslySetInnerHTML={{ __html: barcodeSvgMarkup }} />
                            ) : (
                              <span className="small text-secondary text-center">Barcode</span>
                            )}
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
                              {barcodeSvgMarkup ? (
                                <span className="ims-barcode-preview ims-barcode-preview-sm" dangerouslySetInnerHTML={{ __html: barcodeSvgMarkup }} />
                              ) : (
                                <span className="small text-secondary text-center">Barcode</span>
                              )}
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
                          <div className="small text-secondary text-truncate">{selectedAssetLocation}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary me-2" type="submit" disabled={savingLog || !form.asset_id || !form.printable_tag_id}>
                      {savingLog ? (
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                      ) : (
                        <i className="bi bi-printer me-1" />
                      )}
                      {savingLog ? "Saving..." : "Save Print Log"}
                    </button>
                    <button className="btn btn-sm btn-outline-primary" type="button" disabled={savingLog || !form.asset_id || !form.printable_tag_id} onClick={printCurrentTag}>
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

            {isLogListLoading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-secondary">
                  <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
                  <div className="fw-semibold">Loading tag print logs...</div>
                  <div className="small">Fetching asset tag history and selected asset details.</div>
                </div>
              </div>
            ) : (
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
                    render: (row: TagPrintLog) => {
                      const isDeleting = deletingLogId === row.id;

                      return (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          type="button"
                          disabled={isDeleting}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteLog(row.id);
                          }}
                        >
                          {isDeleting ? (
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                          ) : (
                            <i className="bi bi-trash me-1" />
                          )}
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      );
                    },
                  },
                ]}
                rows={rows}
                empty="No print logs found."
                rowClassName={() => "cursor-pointer"}
                onRowClick={(row) => selectLogForPrinting(row)}
              />
            )}
          </div>
        </div>

        {message ? <div className="alert alert-success mt-2">{message}</div> : null}
        {error ? <div className="alert alert-danger mt-2">{error}</div> : null}
      </div>
    </main>
  );
}
