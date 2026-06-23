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

type AssetFormState = {
  item_id: string;
  category_code: string;
  subcategory_code: string;
  department_id: string;
  department_code: string;
  building_id: string;
  building_code: string;
  room_id: string;
  room_code: string;
  store_id: string;
  project_id: string;
  funding_source_id: string;
  custodian_user_id: string;
  employee_code: string;
  serial_number: string;
  model: string;
  purchase_cost: string;
  capitalization_date: string;
  useful_life_years: string;
  salvage_value: string;
  old_tag_reference: string;
  status: "in_store" | "issued" | "in_use" | "under_repair" | "missing_under_investigation" | "damaged" | "obsolete" | "disposed" | "written_off";
  condition_status: "new" | "good" | "needs_repair" | "damaged" | "obsolete";
  is_sensitive_controlled: boolean;
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

const createInitialAssetForm = (): AssetFormState => ({
  item_id: "",
  category_code: "",
  subcategory_code: "",
  department_id: "",
  department_code: "",
  building_id: "",
  building_code: "",
  room_id: "",
  room_code: "",
  store_id: "",
  project_id: "",
  funding_source_id: "",
  custodian_user_id: "",
  employee_code: "",
  serial_number: "",
  model: "",
  purchase_cost: "0",
  capitalization_date: "",
  useful_life_years: "",
  salvage_value: "0",
  old_tag_reference: "",
  status: "in_store",
  condition_status: "new",
  is_sensitive_controlled: false,
});

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AssetFormState>(createInitialAssetForm);

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

  const setFormField = <K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateDialog = () => {
    setForm(createInitialAssetForm());
    setError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSaving(false);
  };

  const selectDepartment = (departmentId: string) => {
    const department = lookups.departments.find((row) => String(row.id) === departmentId);
    setForm((current) => ({
      ...current,
      department_id: departmentId,
      department_code: String(department?.code ?? ""),
    }));
  };

  const selectBuilding = (buildingId: string) => {
    const building = lookups.buildings.find((row) => String(row.id) === buildingId);
    setForm((current) => ({
      ...current,
      building_id: buildingId,
      building_code: String(building?.code ?? ""),
    }));
  };

  const selectRoom = (roomId: string) => {
    const room = lookups.rooms.find((row) => String(row.id) === roomId);
    setForm((current) => ({
      ...current,
      room_id: roomId,
      room_code: String(room?.code ?? ""),
    }));
  };

  const selectCategory = (categoryCode: string) => {
    const category = lookups["asset-categories"].find((row) => String(row.code) === categoryCode);
    setForm((current) => ({
      ...current,
      category_code: categoryCode,
      useful_life_years: current.useful_life_years || (category?.useful_life_years ? String(category.useful_life_years) : ""),
      is_sensitive_controlled: Boolean(current.is_sensitive_controlled || category?.is_sensitive_controlled === 1 || category?.is_sensitive_controlled === "1"),
    }));
  };

  const saveAsset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Please sign in before creating asset records.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api.post("/assets", {
        item_id: Number(form.item_id),
        category_code: form.category_code.trim(),
        subcategory_code: form.subcategory_code.trim() || null,
        department_id: Number(form.department_id),
        department_code: form.department_code.trim() || null,
        building_id: form.building_id ? Number(form.building_id) : null,
        building_code: form.building_code.trim() || null,
        room_id: form.room_id ? Number(form.room_id) : null,
        room_code: form.room_code.trim() || null,
        store_id: form.store_id ? Number(form.store_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        funding_source_id: form.funding_source_id ? Number(form.funding_source_id) : null,
        custodian_user_id: form.custodian_user_id ? Number(form.custodian_user_id) : null,
        employee_code: form.employee_code.trim() || null,
        serial_number: form.serial_number.trim() || null,
        model: form.model.trim() || null,
        purchase_cost: Number(form.purchase_cost || 0),
        capitalization_date: form.capitalization_date || null,
        useful_life_years: form.useful_life_years ? Number(form.useful_life_years) : null,
        salvage_value: Number(form.salvage_value || 0),
        old_tag_reference: form.old_tag_reference.trim() || null,
        status: form.status,
        condition_status: form.condition_status,
        is_sensitive_controlled: form.is_sensitive_controlled,
      });

      setDialogOpen(false);
      setForm(createInitialAssetForm());
      setMessage("Asset created successfully.");
      await loadRows();
    } catch {
      setError("Unable to create asset. Verify required fields, duplicate values, and backend connectivity.");
    } finally {
      setSaving(false);
    }
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
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              Create Asset
            </button>
          }
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

        {dialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(58vw, 980px)", maxWidth: "min(58vw, 980px)" }}>
                <form className="modal-content border-0 shadow-lg" onSubmit={saveAsset}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">Create Asset</h5>
                      <div className="small text-secondary">Register a fixed asset and generate asset/tag identity.</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Item <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.item_id} onChange={(event) => setFormField("item_id", event.target.value)} required>
                          <option value="">Choose item</option>
                          {lookups.items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.item_code ? `${item.item_code} - ${item.name}` : `${item.name}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Category Code <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.category_code} onChange={(event) => selectCategory(event.target.value)} required>
                          <option value="">Choose category</option>
                          {lookups["asset-categories"].map((category) => (
                            <option key={category.id} value={String(category.code ?? "")}>
                              {category.code} - {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Subcategory Code</label>
                        <input className="form-control form-control-sm" value={form.subcategory_code} onChange={(event) => setFormField("subcategory_code", event.target.value)} placeholder="e.g. LAP" />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Department <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.department_id} onChange={(event) => selectDepartment(event.target.value)} required>
                          <option value="">Choose department</option>
                          {lookups.departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.code} - {department.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Building</label>
                        <select className="form-select form-select-sm" value={form.building_id} onChange={(event) => selectBuilding(event.target.value)}>
                          <option value="">Choose building</option>
                          {lookups.buildings.map((building) => (
                            <option key={building.id} value={building.id}>
                              {building.code} - {building.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Room</label>
                        <select className="form-select form-select-sm" value={form.room_id} onChange={(event) => selectRoom(event.target.value)}>
                          <option value="">Choose room</option>
                          {lookups.rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.code} - {room.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Store</label>
                        <select className="form-select form-select-sm" value={form.store_id} onChange={(event) => setFormField("store_id", event.target.value)}>
                          <option value="">Choose store</option>
                          {lookups.stores.map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.code} - {store.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Project</label>
                        <select className="form-select form-select-sm" value={form.project_id} onChange={(event) => setFormField("project_id", event.target.value)}>
                          <option value="">No project</option>
                          {lookups["research-projects"].map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.project_code} - {project.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Funding Source</label>
                        <select className="form-select form-select-sm" value={form.funding_source_id} onChange={(event) => setFormField("funding_source_id", event.target.value)}>
                          <option value="">No funding source</option>
                          {lookups["funding-sources"].map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.code} - {source.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Serial Number</label>
                        <input className="form-control form-control-sm" value={form.serial_number} onChange={(event) => setFormField("serial_number", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Model</label>
                        <input className="form-control form-control-sm" value={form.model} onChange={(event) => setFormField("model", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Old Tag Reference</label>
                        <input className="form-control form-control-sm" value={form.old_tag_reference} onChange={(event) => setFormField("old_tag_reference", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Employee / Custodian Code</label>
                        <input className="form-control form-control-sm" value={form.employee_code} onChange={(event) => setFormField("employee_code", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Purchase Cost</label>
                        <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={form.purchase_cost} onChange={(event) => setFormField("purchase_cost", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Capitalization Date</label>
                        <input className="form-control form-control-sm" type="date" value={form.capitalization_date} onChange={(event) => setFormField("capitalization_date", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Useful Life (Years)</label>
                        <input className="form-control form-control-sm" type="number" min="0" step="0.1" value={form.useful_life_years} onChange={(event) => setFormField("useful_life_years", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Salvage Value</label>
                        <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={form.salvage_value} onChange={(event) => setFormField("salvage_value", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Status</label>
                        <select className="form-select form-select-sm" value={form.status} onChange={(event) => setFormField("status", event.target.value as AssetFormState["status"])}>
                          <option value="in_store">In Store</option>
                          <option value="issued">Issued</option>
                          <option value="in_use">In Use</option>
                          <option value="under_repair">Under Repair</option>
                          <option value="missing_under_investigation">Missing / Under Investigation</option>
                          <option value="damaged">Damaged</option>
                          <option value="obsolete">Obsolete</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Condition</label>
                        <select className="form-select form-select-sm" value={form.condition_status} onChange={(event) => setFormField("condition_status", event.target.value as AssetFormState["condition_status"])}>
                          <option value="new">New</option>
                          <option value="good">Good</option>
                          <option value="needs_repair">Needs Repair</option>
                          <option value="damaged">Damaged</option>
                          <option value="obsolete">Obsolete</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-4 d-flex align-items-end">
                        <div className="form-check">
                          <input
                            id="asset-sensitive"
                            className="form-check-input"
                            type="checkbox"
                            checked={form.is_sensitive_controlled}
                            onChange={(event) => setFormField("is_sensitive_controlled", event.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="asset-sensitive">
                            Sensitive / Controlled Asset
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeDialog}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving || !authReady}>
                      <i className="bi bi-plus-circle me-1" />
                      {saving ? "Saving..." : "Create Asset"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div className="modal-backdrop fade show" onClick={closeDialog} />
          </>
        ) : null}
      </div>
    </main>
  );
}
