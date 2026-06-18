"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

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

const toDateDisplay = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value.includes("T") ? (value.split("T")[0] ?? "-") : value;
};

const toMoney = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AssetsPage() {
  const { isAuthenticated } = useAuth();
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

  const authReady = useMemo(() => isAuthenticated, [isAuthenticated]);

  const lookupLabel = (key: LookupKey, value: unknown, fallback = "-") => {
    if (value === null || value === undefined || value === "") return fallback;
    const rows = lookups[key] ?? [];
    const match = rows.find((row) => String(row.id) === String(value));

    if (!match) return String(value);
    return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? ""}`;
  };

  const loadRows = useCallback(async () => {
    if (!authReady) return;

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
  }, [authReady, search, statusFilter, departmentFilter, itemFilter, categoryFilter, storeFilter, buildingFilter, roomFilter, projectFilter, fundingSourceFilter, custodianFilter, dateFromFilter, dateToFilter]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

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
        const response = await api.get(`/master-data/${path}`);
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[key] = payload;
        }
      }),
    );

    setLookups(next);
  }, [authReady]);

  useEffect(() => {
    const reload = async () => {
      await loadRows();
    };

    void reload();
  }, [loadRows]);

  useEffect(() => {
    const reloadLookups = async () => {
      await loadLookups();
    };

    void reloadLookups();
  }, [loadLookups]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setDepartmentFilter("");
    setItemFilter("");
    setCategoryFilter("");
    setStoreFilter("");
    setBuildingFilter("");
    setRoomFilter("");
    setProjectFilter("");
    setFundingSourceFilter("");
    setCustodianFilter("");
    setDateFromFilter("");
    setDateToFilter("");

    setTimeout(() => {
      void loadRows();
    }, 0);
  };

  const tableColumns = [
    {
      key: "asset_id",
      header: "Asset ID",
      render: (row: AssetRow) => (
        <Link className="link-primary text-decoration-none fw-medium" href={`/assets/${row.id}`}>
          {row.asset_id ?? "-"}
        </Link>
      ),
    },
    { key: "printable_tag_id", header: "Printable Tag", render: (row: AssetRow) => <>{row.printable_tag_id ?? "-"}</> },
    {
      key: "serial",
      header: "Serial / Employee",
      render: (row: AssetRow) => <>{row.serial_number ?? row.employee_code ?? "-"}</>,
    },
    {
      key: "item",
      header: "Item",
      render: (row: AssetRow) => (
        <>
          <div>{row.item_code}</div>
          <small className="text-secondary">{row.item_name}</small>
        </>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row: AssetRow) => (
        <>
          <div>{row.category_name}</div>
          <small className="text-secondary">{row.subcategory_code ?? "-"}</small>
        </>
      ),
    },
    { key: "custodian_name", header: "Custodian", render: (row: AssetRow) => <>{row.custodian_name ?? "-"}</> },
    {
      key: "department",
      header: "Department",
      render: (row: AssetRow) => <>{lookupLabel("departments", row.department_id, "-")}</>,
    },
    {
      key: "location",
      header: "Location",
      render: (row: AssetRow) => (
        <>
          <div>{row.building_name ?? "-"}</div>
          <small className="text-secondary">{row.room_name ?? "-"}</small>
        </>
      ),
    },
    { key: "status", header: "Status", render: (row: AssetRow) => <StatusBadge status={row.status} /> },
    {
      key: "purchase_cost",
      header: "Purchase Cost",
      render: (row: AssetRow) => toMoney(row.purchase_cost),
    },
    { key: "condition_status", header: "Condition", render: (row: AssetRow) => <>{row.condition_status ?? "-"}</> },
    { key: "created_at", header: "Created", render: (row: AssetRow) => <small>{toDateDisplay(row.created_at)}</small> },
    { key: "model", header: "Model", render: (row: AssetRow) => <>{row.model ?? "-"}</> },
    {
      key: "actions",
      header: "Tag Actions",
      render: (row: AssetRow) => {
        const generatedTag = row.printable_tag_id || `${row.asset_id || `FA-${row.id}`}-TAG`;

        return (
          <Link
            className="btn btn-sm btn-outline-primary"
            href={`/tag-print-log?asset_id=${row.id}&asset_code=${encodeURIComponent(row.asset_id ?? "")}&suggested_tag=${encodeURIComponent(generatedTag)}`}
          >
            <i className="bi bi-qr-code me-1" />
            Generate / Print Tag
          </Link>
        );
      },
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Fixed Asset Register"
          subtitle="View capitalized assets, tags, custody, locations, and status."
          
        />

        {(message || error) && (
          <div className="mb-3">
            {message && <div className="alert alert-success mb-0">{message}</div>}
            {error && <div className="alert alert-danger mb-0">{error}</div>}
          </div>
        )}

        <FilterBar onReset={clearFilters}>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Search</label>
            <input className="form-control form-control-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Status</label>
            <select className="form-select form-select-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {fixedAssetStatusOptions.map((status) => (
                <option key={status.value || "all"} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Department</label>
            <select className="form-select form-select-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} - {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Item</label>
            <select className="form-select form-select-sm" value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code ? `${item.item_code} - ${item.name}` : `${item.name}`}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Category</label>
            <select className="form-select form-select-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All</option>
              {lookups["asset-categories"].map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} - {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Store</label>
            <select className="form-select form-select-sm" value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} - {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Building</label>
            <select className="form-select form-select-sm" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.code} - {building.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Room</label>
            <select className="form-select form-select-sm" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.code} - {room.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Project</label>
            <select className="form-select form-select-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">All</option>
              {lookups["research-projects"].map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_code} - {project.title}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Funding Source</label>
            <select className="form-select form-select-sm" value={fundingSourceFilter} onChange={(event) => setFundingSourceFilter(event.target.value)}>
              <option value="">All</option>
              {lookups["funding-sources"].map((source) => (
                <option key={source.id} value={source.id}>
                  {source.code} - {source.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Custodian ID</label>
            <input
              type="number"
              min="0"
              className="form-control form-control-sm"
              value={custodianFilter}
              onChange={(event) => setCustodianFilter(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Date from</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateFromFilter}
              onChange={(event) => setDateFromFilter(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Date to</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateToFilter}
              onChange={(event) => setDateToFilter(event.target.value)}
            />
          </div>
        </FilterBar>

        <DataTable columns={tableColumns} rows={rows} empty="No fixed asset records found." />
      </div>
    </main>
  );
}
