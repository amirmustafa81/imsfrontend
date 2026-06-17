"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
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

  const id = Number(params.id);
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token] = useState(initialToken);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [message, setMessage] = useState("Loading asset details...");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const clearAsset = () => {
    setAsset(null);
    setMovements([]);
    setMessage("");
    setError("");
  };

  const loadAsset = useCallback(async () => {
    if (!token || Number.isNaN(id) || id <= 0) {
      setError("Unable to resolve this asset ID.");
      return;
    }

    try {
      const [assetResponse, movementResponse] = await Promise.all([
        api.get<{ data: AssetDetail }>(`/assets/${id}`, authHeaders),
        api.get<{ data: AssetMovement[] }>("/asset-movements", { ...authHeaders, params: { asset_id: id } }),
      ]);

      setAsset(assetResponse.data?.data ?? null);
      setMovements(Array.isArray(movementResponse.data?.data) ? movementResponse.data?.data : []);
      setError("");
      setMessage("");
    } catch {
      clearAsset();
      setError("Unable to load asset information. Check token and permission scope.");
    }
  }, [authHeaders, id, token]);

  useEffect(() => {
    void loadAsset();
  }, [loadAsset]);

  const movementRows = useMemo(() => movementResponseSearch(movements, search), [movements, search]);

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

  if (!token) {
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
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => router.push("/assets")}>
              <i className="bi bi-arrow-left me-1" />
              Back
            </button>
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
                        <div className="fw-medium">
                          {asset.qr_code_path ? "QR available" : "No QR"} / {asset.barcode_value ?? "-"}
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

            <div className="row g-3">
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
