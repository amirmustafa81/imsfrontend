"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AssetCreateDialog } from "@/components/ims/AssetCreateDialog";
import { DataTable, FilterBar, KpiCard, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "departments" | "asset-categories" | "buildings" | "rooms" | "users";

type LookupRow = {
  id: number;
  code?: string | null;
  name?: string | null;
  parent_category_id?: number | string | null;
  [key: string]: string | number | boolean | null | undefined;
};

type LabAssetRow = {
  id: number;
  asset_id: string | null;
  printable_tag_id: string | null;
  serial_number: string | null;
  item_code: string | null;
  item_name: string | null;
  category_id: number | null;
  category_code: string | null;
  category_name: string | null;
  subcategory_code: string | null;
  model: string | null;
  status: string;
  condition_status: string | null;
  is_sensitive_controlled: boolean;
  department_id: number | null;
  department_name: string | null;
  building_id: number | null;
  building_name: string | null;
  room_id: number | null;
  room_name: string | null;
  store_id: number | null;
  store_name: string | null;
  custodian_id: number | null;
  custodian_name: string | null;
  project_code: string | null;
  project_title: string | null;
};

const initialLookups: Record<LookupKey, LookupRow[]> = {
  departments: [],
  "asset-categories": [],
  buildings: [],
  rooms: [],
  users: [],
};

const statusOptions = [
  { value: "", label: "All" },
  { value: "in_store", label: "In Store" },
  { value: "issued", label: "Issued" },
  { value: "in_use", label: "In Use" },
  { value: "under_repair", label: "Under Repair" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "disposed", label: "Disposed" },
];

const conditionOptions = [
  { value: "", label: "All Conditions" },
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "needs_repair", label: "Needs Repair" },
  { value: "damaged", label: "Damaged" },
  { value: "obsolete", label: "Obsolete" },
];

const formatLookup = (row: LookupRow) => {
  const code = row.code ? `${row.code} - ` : "";
  return `${code}${row.name ?? row.id}`;
};

const formatSubcategory = (subcategoryCode: string | null, subcategories: LookupRow[]) => {
  if (!subcategoryCode) return "-";
  const match = subcategories.find((row) => String(row.code ?? "") === String(subcategoryCode));
  return match ? formatLookup(match) : subcategoryCode;
};

const formatLocation = (row: LabAssetRow) => {
  const location = [row.building_name, row.room_name].filter(Boolean).join(" / ");
  return location || "-";
};

const buildTagUrl = (row: LabAssetRow) => {
  const generatedTag = row.printable_tag_id || `${row.asset_id || `FA-${row.id}`}-TAG`;
  return `/tag-print-log?asset_id=${row.id}&asset_code=${encodeURIComponent(row.asset_id ?? "")}&suggested_tag=${encodeURIComponent(generatedTag)}`;
};

export default function LabInventoryPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [subcategoryCode, setSubcategoryCode] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [custodianId, setCustodianId] = useState("");
  const [conditionStatus, setConditionStatus] = useState("");
  const [rows, setRows] = useState<LabAssetRow[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, LookupRow[]>>(initialLookups);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);

  const labCategory = useMemo(
    () =>
      lookups["asset-categories"].find(
        (category) => !category.parent_category_id && String(category.code ?? "").toUpperCase() === "LAB",
      ),
    [lookups],
  );

  const labSubcategories = useMemo(
    () =>
      labCategory
        ? lookups["asset-categories"].filter((category) => String(category.parent_category_id ?? "") === String(labCategory.id))
        : [],
    [labCategory, lookups],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (labCategory && String(row.category_id ?? "") !== String(labCategory.id)) return false;
        if (subcategoryCode && row.subcategory_code !== subcategoryCode) return false;
        if (conditionStatus && row.condition_status !== conditionStatus) return false;
        return true;
      }),
    [conditionStatus, labCategory, rows, subcategoryCode],
  );

  const kpis = useMemo(() => {
    const inUse = filteredRows.filter((row) => row.status === "in_use" || row.status === "issued").length;
    const missing = filteredRows.filter((row) => row.status === "missing_under_investigation").length;
    const damaged = filteredRows.filter((row) => row.status === "damaged" || row.status === "under_repair").length;
    const sensitive = filteredRows.filter((row) => row.is_sensitive_controlled).length;

    return { total: filteredRows.length, inUse, missing, damaged, sensitive };
  }, [filteredRows]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    const next = { ...initialLookups } as Record<LookupKey, LookupRow[]>;
    const loadable = [
      { key: "departments", path: "departments" },
      { key: "asset-categories", path: "asset-categories" },
      { key: "buildings", path: "buildings" },
      { key: "rooms", path: "rooms" },
    ] as const;

    try {
      await Promise.all(
        loadable.map(async ({ key, path }) => {
          const response = await api.get(`/master-data/${path}`);
          const payload = response.data?.data ?? response.data;
          if (Array.isArray(payload)) {
            next[key] = payload;
          }
        }),
      );

      const usersResponse = await api.get("/users");
      const usersPayload = usersResponse.data?.data ?? usersResponse.data;
      if (Array.isArray(usersPayload)) {
        next.users = usersPayload;
      }

      setLookups(next);
      setError("");
    } catch {
      setLookups(initialLookups);
      setError("Unable to load laboratory inventory lookups. Verify token and connection.");
    }
  }, [authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady || !labCategory) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ data: LabAssetRow[] }>("/reports/fixed-assets", {
        params: {
          category_id: String(labCategory.id),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(departmentId ? { department_id: departmentId } : {}),
          ...(status ? { status } : {}),
          ...(buildingId ? { building_id: buildingId } : {}),
          ...(roomId ? { room_id: roomId } : {}),
          ...(custodianId ? { custodian_id: custodianId } : {}),
        },
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load laboratory inventory. Verify token and permissions.");
    } finally {
      setLoading(false);
    }
  }, [authReady, buildingId, custodianId, departmentId, labCategory, roomId, search, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const reset = () => {
    setSearch("");
    setDepartmentId("");
    setStatus("");
    setSubcategoryCode("");
    setBuildingId("");
    setRoomId("");
    setCustodianId("");
    setConditionStatus("");
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Laboratory Inventory"
          subtitle="Laboratory equipment and lab-controlled assets grouped by category, location, condition, and custodian."
          actions={
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setAssetDialogOpen(true)}>
              <i className="bi bi-plus-lg me-1" />
              Register Lab Asset
            </button>
          }
        />

        <div className="row g-3 mb-3">
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-eyedropper" label="Lab Assets" value={kpis.total} tone="primary" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-person-check" label="In Use / Issued" value={kpis.inUse} tone="success" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-search" label="Missing" value={kpis.missing} tone="danger" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-tools" label="Damaged / Repair" value={kpis.damaged} tone="warning" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-shield-check" label="Sensitive" value={kpis.sensitive} tone="info" />
          </div>
        </div>

        <FilterBar onReset={reset}>
          <div className="col-12 col-md-4 col-xl-3">
            <label className="form-label small mb-1">Search</label>
            <input className="form-control form-control-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asset, serial, item, model, custodian" />
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Department</label>
            <select className="form-select form-select-sm" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">All Departments</option>
              {lookups.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {formatLookup(department)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Subcategory</label>
            <select className="form-select form-select-sm" value={subcategoryCode} onChange={(event) => setSubcategoryCode(event.target.value)}>
              <option value="">All Lab Subcategories</option>
              {labSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={String(subcategory.code ?? "")}>
                  {formatLookup(subcategory)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Building</label>
            <select className="form-select form-select-sm" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
              <option value="">All Buildings</option>
              {lookups.buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {formatLookup(building)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Room</label>
            <select className="form-select form-select-sm" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">All Rooms</option>
              {lookups.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {formatLookup(room)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Custodian</label>
            <select className="form-select form-select-sm" value={custodianId} onChange={(event) => setCustodianId(event.target.value)}>
              <option value="">All Custodians</option>
              {lookups.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.id}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Condition</label>
            <select className="form-select form-select-sm" value={conditionStatus} onChange={(event) => setConditionStatus(event.target.value)}>
              {conditionOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <DataTable
          columns={[
            { key: "asset_id", header: "Asset ID", render: (row: LabAssetRow) => <Link className="link-primary text-decoration-none fw-medium" href={`/assets/${row.id}`}>{row.asset_id ?? "-"}</Link> },
            { key: "serial_number", header: "Serial", render: (row: LabAssetRow) => <>{row.serial_number ?? "-"}</> },
            { key: "item", header: "Item", render: (row: LabAssetRow) => <><div>{row.item_name ?? "-"}</div><small className="text-secondary">{row.item_code ?? "-"}</small></> },
            { key: "subcategory", header: "Subcategory", render: (row: LabAssetRow) => <>{formatSubcategory(row.subcategory_code, labSubcategories)}</> },
            { key: "model", header: "Model", render: (row: LabAssetRow) => <>{row.model ?? "-"}</> },
            { key: "department_name", header: "Department", render: (row: LabAssetRow) => <>{row.department_name ?? "-"}</> },
            { key: "location", header: "Location", render: (row: LabAssetRow) => <>{formatLocation(row)}</> },
            { key: "store_name", header: "Store", render: (row: LabAssetRow) => <>{row.store_name ?? "-"}</> },
            { key: "custodian_name", header: "Custodian", render: (row: LabAssetRow) => <>{row.custodian_name ?? "-"}</> },
            { key: "project", header: "Project", render: (row: LabAssetRow) => <>{row.project_title || row.project_code || "-"}</> },
            { key: "printable_tag_id", header: "Printable Tag", render: (row: LabAssetRow) => <>{row.printable_tag_id ?? "-"}</> },
            { key: "condition_status", header: "Condition", render: (row: LabAssetRow) => <>{row.condition_status ?? "-"}</> },
            { key: "status", header: "Status", render: (row: LabAssetRow) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              header: "Actions",
              render: (row: LabAssetRow) => (
                <div className="d-flex flex-wrap gap-1">
                  <Link className="btn btn-sm btn-outline-secondary" href={`/assets/${row.id}`}><i className="bi bi-eye me-1" />View</Link>
                  <Link className="btn btn-sm btn-outline-primary" href={buildTagUrl(row)}><i className="bi bi-qr-code me-1" />Print Tag</Link>
                  <Link className="btn btn-sm btn-outline-secondary" href={`/assets/${row.id}/movements`}><i className="bi bi-arrow-left-right me-1" />Movements</Link>
                </div>
              ),
            },
          ]}
          rows={filteredRows}
          empty={loading ? "Loading laboratory inventory..." : "No laboratory assets found."}
        />

        <AssetCreateDialog
          open={assetDialogOpen}
          title="Register Lab Asset"
          subtitle="Create a lab equipment or laboratory inventory asset record."
          defaults={{ category_code: "LAB", status: "in_store", is_sensitive_controlled: true }}
          onClose={() => setAssetDialogOpen(false)}
          onCreated={loadRows}
        />
      </div>
    </main>
  );
}
