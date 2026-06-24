"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ims";

type Relation = { id?: number; name?: string; asset_id?: string; serial_number?: string };

type AssetDetail = {
  id: number;
  asset_id: string;
  printable_tag_id: string | null;
  old_tag_reference: string | null;
  item_id: number;
  receipt_item_id: number | null;
  category_code: string;
  subcategory_code: string | null;
  serial_no_component: string | null;
  department_code: string | null;
  building_code: string | null;
  room_code: string | null;
  employee_code: string | null;
  serial_number: string | null;
  model: string | null;
  purchase_cost: number | null;
  capitalization_date: string | null;
  useful_life_years: number | null;
  salvage_value: number | null;
  accumulated_depreciation: number | null;
  net_book_value: number | null;
  depreciation_start_date: string | null;
  last_depreciation_date: string | null;
  department_id: number | null;
  building_id: number | null;
  room_id: number | null;
  custodian_user_id: number | null;
  store_id: number | null;
  project_id: number | null;
  funding_source_id: number | null;
  status: string;
  condition_status: string;
  qr_code_path: string | null;
  barcode_value: string | null;
  is_sensitive_controlled: boolean;
  is_fully_depreciated: boolean;
  created_at: string;
  updated_at: string;
  attribute_details?: Array<{ code: string; label: string; field_type: string; value: string | boolean }>;
  department?: Relation | null;
  building?: Relation | null;
  room?: Relation | null;
  store?: Relation | null;
  custodian_user?: Relation | null;
  project?: { id?: number; project_code?: string; title?: string } | null;
  funding_source?: Relation | null;
  item?: { id?: number; name?: string; item_code?: string } | null;
};

type AssetMovement = {
  id: number;
  movement_no: string;
  movement_type: string;
  movement_date: string;
  from_department_id: number | null;
  to_department_id: number | null;
  from_room_id: number | null;
  to_room_id: number | null;
  from_custodian_user_id: number | null;
  to_custodian_user_id: number | null;
  remarks: string | null;
  from_department?: Relation | null;
  to_department?: Relation | null;
  from_room?: Relation | null;
  to_room?: Relation | null;
  from_custodian?: Relation | null;
  to_custodian?: Relation | null;
};

type RelationLookup = {
  id: number | null;
  value?: string | null;
};

type AssetStatusForm = {
  status: string;
  condition_status: string;
};

const assetStatusOptions = [
  { value: "in_store", label: "In Store" },
  { value: "issued", label: "Issued" },
  { value: "in_use", label: "In Use" },
  { value: "under_repair", label: "Under Repair" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "obsolete", label: "Obsolete" },
  { value: "disposed", label: "Disposed" },
  { value: "written_off", label: "Written Off" },
];

const conditionStatusOptions = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "needs_repair", label: "Needs Repair" },
  { value: "damaged", label: "Damaged" },
  { value: "obsolete", label: "Obsolete" },
];

const toMoney = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value.includes("T") ? value.split("T")[0] ?? "-" : value;
};

const relationName = (lookup: Relation | null | undefined, fallback = "-"): string => {
  if (!lookup) return fallback;
  return [lookup.asset_id, lookup.serial_number, lookup.name].filter(Boolean).join(" - ");
};

const toPlainText = (item?: RelationLookup | null) => {
  if (!item) return "-";
  const value = String(item.value || "").trim();
  if (item.id === null) return "-";
  return value || String(item.id);
};

const formatAttributeValue = (value: string | boolean): string => {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value || "-";
};

function movementResponseSearch(rows: AssetMovement[], query: string): AssetMovement[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) =>
    [row.movement_no, row.movement_type, row.remarks].some((value) => value?.toLowerCase().includes(normalized)),
  );
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const id = Number(params.id);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [statusForm, setStatusForm] = useState<AssetStatusForm>({ status: "", condition_status: "" });
  const [savingStatus, setSavingStatus] = useState(false);
  const [message, setMessage] = useState("Loading asset details...");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [assetDetailUrl, setAssetDetailUrl] = useState("");

  const clearAsset = () => {
    setAsset(null);
    setMovements([]);
    setMessage("");
    setError("");
  };

  const loadAsset = useCallback(async () => {
    if (authLoading || !isAuthenticated || Number.isNaN(id) || id <= 0) {
      setError("Unable to resolve this asset ID.");
      return;
    }

    try {
      const [assetResponse, movementResponse] = await Promise.all([
        api.get<{ data: AssetDetail }>(`/assets/${id}`),
        api.get<{ data: AssetMovement[] }>("/asset-movements", { params: { asset_id: id } }),
      ]);

      const loadedAsset = assetResponse.data?.data ?? null;
      setAsset(loadedAsset);
      setStatusForm({
        status: loadedAsset?.status ?? "",
        condition_status: loadedAsset?.condition_status ?? "",
      });
      setMovements(Array.isArray(movementResponse.data?.data) ? movementResponse.data?.data : []);
      setError("");
      setMessage("");
    } catch {
      clearAsset();
      setError("Unable to load asset information. Check token and permission scope.");
    }
  }, [authLoading, id, isAuthenticated]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadAsset();
  }, [loadAsset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const movementRows = useMemo(() => movementResponseSearch(movements, search), [movements, search]);

  const generatedTagId = asset?.printable_tag_id || (asset?.asset_id ? `${asset.asset_id}-TAG` : `FA-${asset?.id ?? 0}`);
  const tagPrintQuery = asset ? `asset_id=${asset.id}&asset_code=${encodeURIComponent(asset.asset_id)}&suggested_tag=${encodeURIComponent(generatedTagId)}` : "";

  useEffect(() => {
    if (!asset || typeof window === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssetDetailUrl("");
      return;
    }

    setAssetDetailUrl(new URL(`/assets/${asset.id}`, window.location.origin).toString());
  }, [asset]);

  useEffect(() => {
    const qrPayload = assetDetailUrl.trim();

    if (!asset || !qrPayload) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrDataUrl("");
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(qrPayload, {
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
  }, [asset, assetDetailUrl]);

  const saveStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!asset) {
      setError("Load an asset before updating status.");
      return;
    }

    setSavingStatus(true);
    setError("");
    setMessage("");

    try {
      const response = await api.put<{ data: AssetDetail }>(`/assets/${asset.id}`, {
        status: statusForm.status || null,
        condition_status: statusForm.condition_status || null,
      });
      const updatedAsset = response.data?.data ?? asset;
      setAsset(updatedAsset);
      setStatusForm({
        status: updatedAsset.status ?? "",
        condition_status: updatedAsset.condition_status ?? "",
      });
      setMessage("Asset status updated.");
    } catch {
      setError("Unable to update asset status. Check permissions and selected values.");
    } finally {
      setSavingStatus(false);
    }
  };

  if (Number.isNaN(id) || id <= 0) {
    return (
      <main className="min-vh-100 bg-body-tertiary">
        <div className="container-fluid p-4">
          <PageHeader title="Invalid Asset" subtitle="Selected asset identifier is invalid." />
          <EmptyState title="Invalid Asset" message="Use the Fixed Asset Register to open a valid record." />
          <div className="mt-3">
            <Link className="btn btn-outline-secondary btn-sm" href="/assets">
              <i className="bi bi-arrow-left me-1" />
              Back to Fixed Asset Register
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-vh-100 bg-body-tertiary">
        <div className="container-fluid p-4">
          <PageHeader title="Asset Detail" subtitle="Open details for a fixed asset." />
          <div className="alert alert-warning">Save your API token first to load this record.</div>
          <Link className="btn btn-outline-secondary btn-sm" href="/assets">
            <i className="bi bi-arrow-left me-1" />
            Back to list
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title={asset ? `${asset.asset_id} / ${asset.item?.name ?? "Asset"}` : "Asset Detail"}
          subtitle="Track fixed asset identity, location, cost, and movement history."
          actions={
            <div className="d-flex gap-2">
              <Link href={`/issues-returns?asset_id=${asset?.id ?? ""}&transaction_type=issue`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-arrow-up-right-square me-1" />
                Open Issue / Return
              </Link>
              <Link href={`/maintenance-records?asset_id=${asset?.id ?? ""}`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-tools me-1" />
                Open Maintenance
              </Link>
              <Link href={`/assets/${asset?.id ?? ""}/movements`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-diagram-3 me-1" />
                Open Movement History
              </Link>
              <Link href={`/tag-print-log?${tagPrintQuery}`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-qr-code me-1" />
                Generate / Print Tag
              </Link>
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => router.push("/assets")}>
                <i className="bi bi-arrow-left me-1" />
                Back
              </button>
            </div>
          }
        />

        {(message || error) && (
          <div className="mb-3">
            {message ? <div className="alert alert-info mb-0">{message}</div> : null}
            {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
          </div>
        )}

        {asset ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-12 col-xl-7">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white fw-semibold">Core Identity</div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="small text-secondary">Asset ID</div>
                        <div className="fw-medium">{asset.asset_id}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Printable Tag</div>
                        <div className="fw-medium">{asset.printable_tag_id ?? "-"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Category / Subcategory</div>
                        <div className="fw-medium">
                          {asset.category_code}
                          {asset.subcategory_code ? ` / ${asset.subcategory_code}` : ""}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Item</div>
                        <div className="fw-medium">
                          {asset.item?.name ? `${asset.item.item_code ?? ""} ${asset.item.item_code ? "-" : ""} ${asset.item.name}`.trim() : "-"}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Serial / Employee</div>
                        <div className="fw-medium">{asset.serial_number ?? asset.employee_code ?? "-"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Model</div>
                        <div className="fw-medium">{asset.model ?? "-"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Serial No. Component</div>
                        <div className="fw-medium">{asset.serial_no_component ?? "-"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">QR / Barcode</div>
                        <div className="d-flex align-items-center gap-3 mt-1">
                          <div className="border bg-white d-flex align-items-center justify-content-center ims-tag-qr-box">
                            {qrDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img className="ims-qr-preview-img" src={qrDataUrl} alt={`QR code for ${assetDetailUrl || generatedTagId}`} />
                            ) : (
                              <span className="small text-secondary">QR</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="fw-medium text-break">{generatedTagId}</div>
                            <small className="text-secondary text-break">{assetDetailUrl || asset.barcode_value || `BC-${asset.asset_id}`}</small>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Status</div>
                        <StatusBadge status={asset.status} />
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Condition</div>
                        <div className="fw-medium">{asset.condition_status ?? "-"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-secondary">Created / Updated</div>
                        <div className="fw-medium">
                          {toDate(asset.created_at)} / {toDate(asset.updated_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-5">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white fw-semibold">Location & Custody</div>
                  <div className="card-body">
                    <div className="mb-2">
                      <div className="small text-secondary">Department</div>
                      <div className="fw-medium">
                        {relationName(asset.department)} ({asset.department_code ?? "no dept code"})
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="small text-secondary">Building / Room</div>
                      <div className="fw-medium">
                        {[asset.building?.name || asset.building_code, asset.room?.name || asset.room_code].filter(Boolean).join(" / ") || "-"}
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="small text-secondary">Store</div>
                      <div className="fw-medium">{asset.store?.name ?? "-"}</div>
                    </div>
                    <div className="mb-2">
                      <div className="small text-secondary">Custodian</div>
                      <div className="fw-medium">{relationName(asset.custodian_user)}</div>
                    </div>
                    <div className="mb-2">
                      <div className="small text-secondary">Project / Funding Source</div>
                      <div className="fw-medium">
                        {asset.project?.project_code ? `${asset.project.project_code} - ${asset.project.title}` : "-"}
                        {asset.project?.project_code && asset.funding_source?.name ? " / " : ""}
                        {asset.funding_source?.name ?? ""}
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="small text-secondary">Controls</div>
                      <div className="fw-medium">
                        {asset.is_sensitive_controlled ? "Sensitive asset" : "Non-sensitive"}
                        {" / "}
                        {asset.is_fully_depreciated ? "Fully depreciated" : "Active depreciation"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {asset.attribute_details && asset.attribute_details.length > 0 ? (
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-white fw-semibold">Specifications</div>
                <div className="card-body">
                  <div className="row g-3">
                    {asset.attribute_details.map((attribute) => (
                      <div className="col-12 col-md-4 col-xl-3" key={attribute.code}>
                        <div className="small text-secondary">{attribute.label}</div>
                        <div className="fw-medium">{formatAttributeValue(attribute.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="row g-3">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Status Update</div>
                  <div className="card-body">
                    <form className="row g-3 align-items-end" onSubmit={saveStatus}>
                      <div className="col-12 col-md-4">
                        <label className="form-label small mb-1">Asset Status</label>
                        <select
                          className="form-select form-select-sm"
                          value={statusForm.status}
                          onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}
                        >
                          <option value="">Select status</option>
                          {assetStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small mb-1">Condition</label>
                        <select
                          className="form-select form-select-sm"
                          value={statusForm.condition_status}
                          onChange={(event) => setStatusForm((current) => ({ ...current, condition_status: event.target.value }))}
                        >
                          <option value="">Select condition</option>
                          {conditionStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-auto">
                        <button className="btn btn-sm btn-primary" type="submit" disabled={savingStatus}>
                          <i className="bi bi-check2-circle me-1" />
                          {savingStatus ? "Saving..." : "Save Status"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Financial Snapshot</div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="small text-secondary">Purchase Cost</div>
                        <div className="fw-semibold">{toMoney(asset.purchase_cost)}</div>
                      </div>
                      <div className="col-12">
                        <div className="small text-secondary">Capitalization Date</div>
                        <div className="fw-semibold">{toDate(asset.capitalization_date)}</div>
                      </div>
                      <div className="col-6">
                        <div className="small text-secondary">Useful Life (Years)</div>
                        <div className="fw-semibold">{asset.useful_life_years ?? "-"}</div>
                      </div>
                      <div className="col-6">
                        <div className="small text-secondary">Salvage Value</div>
                        <div className="fw-semibold">{toMoney(asset.salvage_value)}</div>
                      </div>
                      <div className="col-6">
                        <div className="small text-secondary">Accumulated Depreciation</div>
                        <div className="fw-semibold">{toMoney(asset.accumulated_depreciation)}</div>
                      </div>
                      <div className="col-6">
                        <div className="small text-secondary">Net Book Value</div>
                        <div className="fw-semibold">{toMoney(asset.net_book_value)}</div>
                      </div>
                      <div className="col-6">
                        <div className="small text-secondary">Depreciation Start</div>
                        <div className="fw-semibold">{toDate(asset.depreciation_start_date)}</div>
                      </div>
                      <div className="col-6">
                        <div className="small text-secondary">Last Depreciation</div>
                        <div className="fw-semibold">{toDate(asset.last_depreciation_date)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Movement History</div>
                  <div className="card-body">
                    <form
                      className="mb-3"
                      onSubmit={(event: FormEvent) => {
                        event.preventDefault();
                        setSearch(search.trim());
                      }}
                    >
                      <div className="row g-2 align-items-end">
                        <div className="col">
                          <label className="form-label small">Search movements</label>
                          <input
                            className="form-control form-control-sm"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Movement no / remarks"
                          />
                        </div>
                        <div className="col-auto">
                          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setSearch("")}>
                            <i className="bi bi-x-circle me-1" />
                            Clear
                          </button>
                        </div>
                      </div>
                    </form>
                    <DataTable
                      columns={[
                        { key: "movement_no", header: "Movement No" },
                        { key: "movement_type", header: "Type" },
                        { key: "movement_date", header: "Date" },
                        {
                          key: "from_department",
                          header: "From",
                          render: (row: AssetMovement) => (
                            <>
                              {row.from_department?.name ?? toPlainText({ id: row.from_department_id })} /{" "}
                              {row.from_room?.name ?? toPlainText({ id: row.from_room_id })}
                            </>
                          ),
                        },
                        {
                          key: "to_department",
                          header: "To",
                          render: (row: AssetMovement) => (
                            <>
                              {row.to_department?.name ?? toPlainText({ id: row.to_department_id })} /{" "}
                              {row.to_room?.name ?? toPlainText({ id: row.to_room_id })}
                            </>
                          ),
                        },
                        {
                          key: "movement_notes",
                          header: "Movement Notes",
                          render: (row: AssetMovement) => <small>{row.remarks ?? "-"}</small>,
                        },
                      ]}
                      rows={movementRows}
                      empty="No movement records found for this asset."
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Asset not loaded" message="Waiting for selection or API response." />
        )}
      </div>
    </main>
  );
}
