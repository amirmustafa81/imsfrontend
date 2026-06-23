"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type ItemType =
  | "consumable"
  | "fixed_asset"
  | "repairable"
  | "controlled_item"
  | "project_inventory"
  | "sample_prototype"
  | "software_license";

type ItemRow = {
  id: number;
  item_code: string;
  name: string;
  item_type: ItemType;
  category_id: number;
  unit_id: number;
  minimum_stock_level: string | number | null;
  requires_serial_tracking: boolean | number | string;
  requires_qr_tag: boolean | number | string;
  status: "active" | "inactive" | string;
};

type Lookup = {
  id: number;
  code?: string;
  name?: string;
};

type LookupMap = Record<"asset-categories" | "units-of-measure", Lookup[]>;

type ItemFormState = {
  item_code: string;
  name: string;
  item_type: ItemType;
  category_id: string;
  unit_id: string;
  description: string;
  brand: string;
  model: string;
  minimum_stock_level: string;
  is_capitalizable: boolean;
  is_sensitive_controlled: boolean;
  requires_serial_tracking: boolean;
  requires_batch_tracking: boolean;
  requires_expiry_tracking: boolean;
  status: "active" | "inactive";
};

const itemTypeOptions = [
  { value: "", label: "All Types" },
  { value: "consumable", label: "Consumable" },
  { value: "fixed_asset", label: "Fixed Asset" },
  { value: "repairable", label: "Repairable" },
  { value: "controlled_item", label: "Controlled Item" },
  { value: "project_inventory", label: "Project Inventory" },
  { value: "sample_prototype", label: "Sample/Prototype" },
  { value: "software_license", label: "Software License" },
];

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const itemTypeLabelMap: Record<ItemType, string> = {
  consumable: "Consumable",
  fixed_asset: "Fixed Asset",
  repairable: "Repairable",
  controlled_item: "Controlled Item",
  project_inventory: "Project Inventory",
  sample_prototype: "Sample/Prototype",
  software_license: "Software License",
};

const toBoolean = (value: boolean | number | string | null | undefined): boolean =>
  value === true || value === 1 || value === "1" || value === "true";

const formatLookup = (lookupRows: Lookup[], id: number | null) => {
  if (!id) return "-";
  const row = lookupRows.find((rowItem) => rowItem.id === id);
  if (!row) return `#${id}`;
  return `${row.code ?? ""}${row.code && row.name ? " - " : ""}${row.name ?? ""}`.trim() || `#${id}`;
};

const toNumericString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";

  const numberValue = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numberValue)) return "0";
  return String(numberValue);
};

const createInitialForm = (): ItemFormState => ({
  item_code: "",
  name: "",
  item_type: "consumable",
  category_id: "",
  unit_id: "",
  description: "",
  brand: "",
  model: "",
  minimum_stock_level: "0",
  is_capitalizable: false,
  is_sensitive_controlled: false,
  requires_serial_tracking: false,
  requires_batch_tracking: false,
  requires_expiry_tracking: false,
  status: "active",
});

export default function ItemsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [lookups, setLookups] = useState<LookupMap>({
    "asset-categories": [],
    "units-of-measure": [],
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Load data to begin.");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemFormState>(createInitialForm);

  const loadLookups = useCallback(async () => {
    if (!authReady) {
      return;
    }

    try {
      const keys: Array<[LookupMap extends Record<infer K, unknown> ? K & string : never, string]> = [
        ["asset-categories", "asset-categories"],
        ["units-of-measure", "units-of-measure"],
      ];

      const next = { ...lookups };

      await Promise.all(
        keys.map(async ([key, path]) => {
          const response = await api.get<{ data: Lookup[] }>(`/master-data/${path}`, authHeaders);
          const payload = response.data?.data;
          if (Array.isArray(payload)) {
            next[key] = payload;
          }
        }),
      );

      setLookups(next);
      setError("");
    } catch {
      setError("Unable to load item lookups. Verify token and backend connectivity.");
    }
  }, [authHeaders, authReady, lookups]);

  const loadRows = useCallback(async () => {
    if (!authReady) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await api.get<{ data: ItemRow[] }>("/master-data/items", {
        ...authHeaders,
        params: {
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });

      const payload = response.data?.data;
      setRows(Array.isArray(payload) ? payload : []);
      setMessage("Items loaded.");
    } catch {
      setRows([]);
      setError("Unable to load items. Verify token and backend connectivity.");
      setMessage("");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, search, statusFilter, authReady]);

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

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
  };

  const openCreateDialog = () => {
    setForm(createInitialForm());
    setError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSaving(false);
  };

  const setFormField = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Please sign in before creating item records.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api.post(
        "/master-data/items",
        {
          item_code: form.item_code.trim(),
          name: form.name.trim(),
          item_type: form.item_type,
          category_id: Number(form.category_id),
          unit_id: Number(form.unit_id),
          description: form.description.trim() || null,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          minimum_stock_level: Number(form.minimum_stock_level || 0),
          is_capitalizable: form.is_capitalizable,
          is_sensitive_controlled: form.is_sensitive_controlled,
          requires_serial_tracking: form.requires_serial_tracking,
          requires_batch_tracking: form.requires_batch_tracking,
          requires_expiry_tracking: form.requires_expiry_tracking,
          status: form.status,
        },
        authHeaders,
      );

      setDialogOpen(false);
      setForm(createInitialForm());
      setMessage("Item created successfully.");
      await loadRows();
    } catch {
      setError("Unable to create item. Verify required fields, duplicate code, and backend connectivity.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    const normalizedType = typeFilter.trim();
    if (!normalizedType) {
      return rows;
    }

    return rows.filter((row) => row.item_type === normalizedType);
  }, [rows, typeFilter]);

  const columns = [
    { key: "item_code", header: "Code" },
    { key: "name", header: "Name" },
    {
      key: "category_id",
      header: "Category",
      render: (row: ItemRow) => formatLookup(lookups["asset-categories"], row.category_id),
    },
    {
      key: "unit_id",
      header: "UoM",
      render: (row: ItemRow) => formatLookup(lookups["units-of-measure"], row.unit_id),
    },
    {
      key: "item_type",
      header: "Type",
      render: (row: ItemRow) => <span className="badge text-bg-light border text-dark">{itemTypeLabelMap[row.item_type]}</span>,
    },
    { key: "minimum_stock_level", header: "Min", className: "text-end", render: (row: ItemRow) => toNumericString(row.minimum_stock_level) },
    {
      key: "requires_serial_tracking",
      header: "Serial",
      className: "text-center",
      render: (row: ItemRow) =>
        toBoolean(row.requires_serial_tracking) ? (
          <i className="bi bi-check-lg text-success" aria-label="Serial tracked" />
        ) : (
          <span className="text-secondary">&mdash;</span>
        ),
    },
    {
      key: "requires_qr_tag",
      header: "Tag",
      className: "text-center",
      render: (row: ItemRow) =>
        toBoolean(row.requires_qr_tag) ? (
          <i className="bi bi-qr-code text-primary" aria-label="Tag required" />
        ) : (
          <span className="text-secondary">&mdash;</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: ItemRow) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Item Master"
          subtitle="Consumables, fixed assets, controlled items, licenses, and project inventory"
          breadcrumbs={[{ label: "Inventory" }, { label: "Items" }]}
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              Create Item
            </button>
          }
        />

        <FilterBar onReset={resetFilters}>
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              placeholder="Name or code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Type</label>
            <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {itemTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Status</label>
            <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {!authReady ? <div className="alert alert-info">Authentication token required to load live items.</div> : null}
        {message ? <div className="alert alert-light border-0">{message}</div> : null}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Item master list</h2>
          {loading ? <span className="small text-secondary">Loading…</span> : null}
        </div>

        <DataTable columns={columns} rows={filteredRows} empty="No items found." />

        {dialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(54vw, 920px)", maxWidth: "min(54vw, 920px)" }}>
                <form className="modal-content border-0 shadow-lg" onSubmit={saveItem}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">Create Item</h5>
                      <div className="small text-secondary">Add consumables, assets, controlled items, licenses, or project inventory.</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Item Code <span className="text-danger">*</span></label>
                        <input
                          className="form-control form-control-sm"
                          value={form.item_code}
                          onChange={(event) => setFormField("item_code", event.target.value)}
                          placeholder="e.g. IT-LAP-001"
                          required
                        />
                      </div>
                      <div className="col-12 col-md-8">
                        <label className="form-label small">Item Name <span className="text-danger">*</span></label>
                        <input
                          className="form-control form-control-sm"
                          value={form.name}
                          onChange={(event) => setFormField("name", event.target.value)}
                          placeholder="e.g. Laptop Computer"
                          required
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Item Type <span className="text-danger">*</span></label>
                        <select
                          className="form-select form-select-sm"
                          value={form.item_type}
                          onChange={(event) => setFormField("item_type", event.target.value as ItemType)}
                          required
                        >
                          {itemTypeOptions
                            .filter((option) => option.value)
                            .map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Category <span className="text-danger">*</span></label>
                        <select
                          className="form-select form-select-sm"
                          value={form.category_id}
                          onChange={(event) => setFormField("category_id", event.target.value)}
                          required
                        >
                          <option value="">Choose category</option>
                          {lookups["asset-categories"].map((category) => (
                            <option key={category.id} value={category.id}>
                              {formatLookup(lookups["asset-categories"], category.id)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Unit of Measure <span className="text-danger">*</span></label>
                        <select
                          className="form-select form-select-sm"
                          value={form.unit_id}
                          onChange={(event) => setFormField("unit_id", event.target.value)}
                          required
                        >
                          <option value="">Choose UoM</option>
                          {lookups["units-of-measure"].map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {formatLookup(lookups["units-of-measure"], unit.id)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Brand</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.brand}
                          onChange={(event) => setFormField("brand", event.target.value)}
                          placeholder="e.g. Dell"
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Model</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.model}
                          onChange={(event) => setFormField("model", event.target.value)}
                          placeholder="e.g. Latitude 5440"
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Minimum Stock Level</label>
                        <input
                          className="form-control form-control-sm"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.minimum_stock_level}
                          onChange={(event) => setFormField("minimum_stock_level", event.target.value)}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small">Description</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={3}
                          value={form.description}
                          onChange={(event) => setFormField("description", event.target.value)}
                          placeholder="Optional item description"
                        />
                      </div>
                      <div className="col-12">
                        <div className="row g-2">
                          {[
                            ["is_capitalizable", "Capitalizable"],
                            ["is_sensitive_controlled", "Sensitive / Controlled"],
                            ["requires_serial_tracking", "Serial Tracking"],
                            ["requires_batch_tracking", "Batch Tracking"],
                            ["requires_expiry_tracking", "Expiry Tracking"],
                          ].map(([key, label]) => (
                            <div className="col-12 col-md-4" key={key}>
                              <div className="form-check">
                                <input
                                  id={`item-${key}`}
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={Boolean(form[key as keyof ItemFormState])}
                                  onChange={(event) => setFormField(key as keyof ItemFormState, event.target.checked as never)}
                                />
                                <label className="form-check-label small" htmlFor={`item-${key}`}>
                                  {label}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Status</label>
                        <select
                          className="form-select form-select-sm"
                          value={form.status}
                          onChange={(event) => setFormField("status", event.target.value as ItemFormState["status"])}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeDialog}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving || !authReady}>
                      <i className="bi bi-plus-circle me-1" />
                      {saving ? "Saving..." : "Create Item"}
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
