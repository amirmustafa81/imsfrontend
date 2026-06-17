"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LookupKey =
  | "departments"
  | "stores"
  | "items"
  | "asset-categories"
  | "buildings"
  | "rooms"
  | "research-projects"
  | "funding-sources";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type AssetRow = {
  id: number;
  asset_id: string | null;
  printable_tag_id: string | null;
  serial_number: string | null;
  old_tag_reference: string | null;
  item_code: string;
  item_name: string;
  category_name: string;
  subcategory_code: string | null;
  department_code: string | null;
  building_name: string | null;
  room_name: string | null;
  employee_code: string | null;
  model: string | null;
  purchase_cost: number | null;
  status: string;
  condition_status: string | null;
  is_sensitive_controlled: boolean;
  is_fully_depreciated: boolean;
  department_id: number | null;
  department_name: string | null;
  building_id: number | null;
  room_id: number | null;
  store_id: number | null;
  custodian_id: number | null;
  custodian_name: string | null;
  project_id: number | null;
  project_title: string | null;
  funding_source_id: number | null;
  funding_source_name: string | null;
  created_at: string;
};

type FixedAssetStatus =
  | "active"
  | "in_use"
  | "disposed"
  | "missing_under_investigation"
  | "damaged"
  | "pending_disposal"
  | ""
  | "unknown";

const fixedAssetStatusOptions: Array<{ value: FixedAssetStatus; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "in_use", label: "In Use" },
  { value: "disposed", label: "Disposed" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "pending_disposal", label: "Pending Disposal" },
];

const initialLookups: Record<LookupKey, RowData[]> = {
  departments: [],
  stores: [],
  items: [],
  "asset-categories": [],
  buildings: [],
  rooms: [],
  "research-projects": [],
  "funding-sources": [],
};

const statusClass: Record<string, string> = {
  active: "text-bg-success",
  in_use: "text-bg-primary",
  disposed: "text-bg-danger",
  missing_under_investigation: "text-bg-warning",
  damaged: "text-bg-dark",
  pending_disposal: "text-bg-info",
};

const toDateDisplay = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value.includes("T") ? (value.split("T")[0] ?? "-") : value;
};

const toMoney = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AssetsPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>(initialLookups);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [fundingSourceFilter, setFundingSourceFilter] = useState("");
  const [custodianFilter, setCustodianFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  const [message, setMessage] = useState("Load assets to begin.");
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const lookupLabel = (key: LookupKey, value: unknown, fallback = "-") => {
    if (value === null || value === undefined || value === "") return fallback;
    const rows = lookups[key] ?? [];
    const match = rows.find((row) => String(row.id) === String(value));

    if (!match) return String(value);
    return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? ""}`;
  };

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typeof window === "undefined") return;

    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
    setError("");
    setMessage("Token saved. Loading fixed assets.");
  };

  const loadRows = useCallback(async () => {
    if (!token) return;

    try {
      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department_id = departmentFilter;
      if (itemFilter) params.item_id = itemFilter;
      if (categoryFilter) params.category_id = categoryFilter;
      if (storeFilter) params.store_id = storeFilter;
      if (buildingFilter) params.building_id = buildingFilter;
      if (roomFilter) params.room_id = roomFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (fundingSourceFilter) params.funding_source_id = fundingSourceFilter;
      if (custodianFilter) params.custodian_id = custodianFilter;
      if (dateFromFilter) params.date_from = dateFromFilter;
      if (dateToFilter) params.date_to = dateToFilter;

      const response = await api.get("/reports/fixed-assets", {
        ...authHeaders,
        params,
      });

      const payload = response.data?.data;
      setRows(Array.isArray(payload) ? payload : []);
      setError("");
      setMessage("Fixed assets loaded.");
    } catch {
      setRows([]);
      setError("Unable to load fixed assets. Verify token and backend connectivity.");
      setMessage("");
    }
  }, [
    token,
    search,
    statusFilter,
    departmentFilter,
    itemFilter,
    categoryFilter,
    storeFilter,
    buildingFilter,
    roomFilter,
    projectFilter,
    fundingSourceFilter,
    custodianFilter,
    dateFromFilter,
    dateToFilter,
    authHeaders,
  ]);

  const loadLookups = useCallback(async () => {
    if (!token) return;

    const next = {
      ...initialLookups,
    } as Record<LookupKey, RowData[]>;

    const loadable = [
      { key: "departments", path: "departments" },
      { key: "stores", path: "stores" },
      { key: "items", path: "items" },
      { key: "asset-categories", path: "asset-categories" },
      { key: "buildings", path: "buildings" },
      { key: "rooms", path: "rooms" },
      { key: "research-projects", path: "research-projects" },
      { key: "funding-sources", path: "funding-sources" },
    ] as const;

    await Promise.all(
      loadable.map(async ({ key, path }) => {
        const response = await api.get(`/master-data/${path}`, { ...authHeaders });
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[key] = payload;
        }
      }),
    );

    setLookups(next);
  }, [token, authHeaders]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const badgeClass = (status?: string | null) =>
    statusClass[String(status ?? "")] ?? "text-bg-light text-dark";

  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <Link href="/" className="btn btn-link px-0 mb-3">
          <i className="bi bi-arrow-left me-2" />
          Dashboard
        </Link>

        <div className="row g-3 mb-4">
          <div className="col-12 col-xl-4">
            <form onSubmit={submitToken} className="card border-0 shadow-sm">
              <div className="card-body">
                <h2 className="h5 mb-3">API Token</h2>
                <label className="form-label small">Bearer token</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={tmpToken}
                    onChange={(event) => setTmpToken(event.target.value)}
                    placeholder="Paste API token"
                  />
                  <button type="submit" className="btn btn-outline-primary">
                    Save token
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="col-12 col-xl-8">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h1 className="h3 mb-2">Fixed Asset Register</h1>
                <p className="text-secondary mb-0">
                  View capitalized assets, tags, custody, locations, and status.
                </p>
              </div>
            </div>
          </div>

          {(message || error) && (
            <div className="col-12">
              {message && <div className="alert alert-success mb-0">{message}</div>}
              {error && <div className="alert alert-danger mb-0">{error}</div>}
            </div>
          )}
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="h5 mb-3">Filters</h2>
            <div className="row g-2">
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Search</label>
                <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {fixedAssetStatusOptions.map((status) => (
                    <option key={status.value || "all"} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Department</label>
                <select className="form-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} - {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Item</label>
                <select className="form-select" value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_code ? `${item.item_code} - ${item.name}` : `${item.name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Category</label>
                <select className="form-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups["asset-categories"].map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code} - {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Store</label>
                <select className="form-select" value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.code} - {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Building</label>
                <select className="form-select" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.code} - {building.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Room</label>
                <select className="form-select" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.code} - {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Project</label>
                <select className="form-select" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups["research-projects"].map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_code} - {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Funding Source</label>
                <select
                  className="form-select"
                  value={fundingSourceFilter}
                  onChange={(event) => setFundingSourceFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {lookups["funding-sources"].map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} - {source.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Custodian ID</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={custodianFilter}
                  onChange={(event) => setCustodianFilter(event.target.value)}
                />
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Date from</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateFromFilter}
                  onChange={(event) => setDateFromFilter(event.target.value)}
                />
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Date to</label>
                <input type="date" className="form-control" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0">Asset Register</h2>
            <span className="text-secondary">{rows.length} rows</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Printable Tag</th>
                    <th>Serial / Employee</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Custodian</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Purchase Cost</th>
                    <th>Condition</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center text-secondary">
                        No fixed asset records found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <div className="fw-semibold">{asset.asset_id ?? "-"}</div>
                          {asset.old_tag_reference ? <small className="text-secondary">Old: {asset.old_tag_reference}</small> : null}
                        </td>
                        <td>{asset.printable_tag_id ?? "-"}</td>
                        <td>{asset.serial_number ?? asset.employee_code ?? "-"}</td>
                        <td>
                          <div>{asset.item_code}</div>
                          <small className="text-secondary">{asset.item_name}</small>
                        </td>
                        <td>
                          <div>{asset.category_name}</div>
                          <small className="text-secondary">{asset.subcategory_code ?? "-"}</small>
                        </td>
                        <td>{asset.custodian_name ?? "-"}</td>
                        <td>{lookupLabel("departments", asset.department_id, "-")}</td>
                        <td>
                          <div>{asset.building_name ?? "-"}</div>
                          <small className="text-secondary">{asset.room_name ?? "-"}</small>
                        </td>
                        <td>
                          <span className={`badge ${badgeClass(asset.status)}`}>{asset.status}</span>
                        </td>
                        <td>{toMoney(asset.purchase_cost)}</td>
                        <td>{asset.condition_status ?? "-"}</td>
                        <td>
                          <small>{toDateDisplay(asset.created_at)}</small>
                        </td>
                        <td>{asset.model ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
