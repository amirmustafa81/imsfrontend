"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AttributeFields, type AttributeDefinition, type AttributeValues } from "@/components/ims/AttributeFields";
import { DataTable, FieldLabel, FilterBar, PageHeader, SearchableSelect, StatusBadge, type SearchableSelectOption } from "@/components/ims";

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
  subcategory_id: number | null;
  unit_id: number;
  description: string | null;
  brand: string | null;
  model: string | null;
  minimum_stock_level: string | number | null;
  is_capitalizable: boolean | number | string;
  is_sensitive_controlled: boolean | number | string;
  requires_serial_tracking: boolean | number | string;
  requires_batch_tracking: boolean | number | string;
  requires_expiry_tracking: boolean | number | string;
  requires_qr_tag: boolean | number | string;
  status: "active" | "inactive" | string;
  attributes?: AttributeValues;
};

type Lookup = {
  id: number;
  code?: string;
  name?: string;
  parent_category_id?: number | string | null;
};

type LookupMap = {
  "asset-categories": Lookup[];
  "units-of-measure": Lookup[];
  "asset-attribute-definitions": AttributeDefinition[];
};

type ItemFormState = {
  item_code: string;
  name: string;
  item_type: ItemType;
  category_id: string;
  subcategory_id: string;
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
  attributes: AttributeValues;
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

const toLookupOption = (row: Lookup): SearchableSelectOption => ({
  value: String(row.id),
  label: `${row.code ?? ""}${row.code && row.name ? " - " : ""}${row.name ?? ""}`.trim() || `#${row.id}`,
  keywords: `${row.code ?? ""} ${row.name ?? ""}`,
});

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
  subcategory_id: "",
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
  attributes: {},
  status: "active",
});

const infoText = {
  itemCode: "Unique item code used in receipts, stock, issue, asset registration, reports, and imports.",
  itemName: "Official item name shown to users in lists, transactions, receipts, and reports.",
  itemType: "Controls how the item behaves, such as consumable stock, fixed asset, controlled stationery, project inventory, or license.",
  category: "Main classification used for reporting, coding, depreciation policy, and item grouping.",
  subcategory: "More specific classification under the selected category, used for consistent item and asset coding.",
  unit: "Default measurement unit for receipt, stock balance, issue, return, and consumption quantities.",
  minimumStock: "Minimum quantity expected in stock. Reports use this to identify low-stock items.",
  capitalizable: "Enable when this item can become a fixed asset after purchase or registration.",
  sensitive: "Enable for controlled or sensitive items that need stronger tracking and accountability.",
  serial: "Enable when each item or asset must be tracked by serial number.",
  batch: "Enable when stock should be tracked by batch or lot number.",
  expiry: "Enable when expiry date tracking is required for this item.",
  status: "Inactive items remain in history but are normally not selected for new transactions.",
};

export default function ItemsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [lookups, setLookups] = useState<LookupMap>({
    "asset-categories": [],
    "units-of-measure": [],
    "asset-attribute-definitions": [],
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Load data to begin.");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemFormState>(createInitialForm);

  const loadLookups = useCallback(async () => {
    if (!authReady) {
      return;
    }

    try {
      const next: LookupMap = {
        "asset-categories": [],
        "units-of-measure": [],
        "asset-attribute-definitions": [],
      };

      await Promise.all(
        [
          api.get<{ data: Lookup[] }>("/master-data/asset-categories", authHeaders).then((response) => {
            next["asset-categories"] = Array.isArray(response.data?.data) ? response.data.data : [];
          }),
          api.get<{ data: Lookup[] }>("/master-data/units-of-measure", authHeaders).then((response) => {
            next["units-of-measure"] = Array.isArray(response.data?.data) ? response.data.data : [];
          }),
          api.get<{ data: AttributeDefinition[] }>("/master-data/asset-attribute-definitions", authHeaders).then((response) => {
            next["asset-attribute-definitions"] = Array.isArray(response.data?.data) ? response.data.data : [];
          }),
        ],
      );

      setLookups(next);
      setError("");
    } catch {
      setError("Unable to load item lookups. Verify token and backend connectivity.");
    }
  }, [authHeaders, authReady]);

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
    setEditingId(null);
    setForm(createInitialForm());
    setError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setSaving(false);
  };

  const setFormField = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const parentCategories = useMemo(
    () => lookups["asset-categories"].filter((category) => !category.parent_category_id),
    [lookups],
  );

  const selectedCategory = useMemo(
    () => parentCategories.find((category) => String(category.id) === form.category_id),
    [form.category_id, parentCategories],
  );

  const subcategoryOptions = useMemo(
    () => selectedCategory
      ? lookups["asset-categories"].filter((category) => String(category.parent_category_id ?? "") === String(selectedCategory.id))
      : [],
    [lookups, selectedCategory],
  );
  const categorySelectOptions = useMemo(() => parentCategories.map(toLookupOption), [parentCategories]);
  const subcategorySelectOptions = useMemo(() => subcategoryOptions.map(toLookupOption), [subcategoryOptions]);
  const unitSelectOptions = useMemo(() => lookups["units-of-measure"].map(toLookupOption), [lookups]);
  const activeItemTypeOptions = useMemo(
    () => itemTypeOptions.filter((option) => option.value) as SearchableSelectOption[],
    [],
  );
  const activeStatusOptions = useMemo(
    () => statusOptions.filter((option) => option.value) as SearchableSelectOption[],
    [],
  );

  const selectCategory = (categoryId: string) => {
    setForm((current) => ({
      ...current,
      category_id: categoryId,
      subcategory_id: "",
      attributes: {},
    }));
  };

  const startEditing = (row: ItemRow) => {
    setEditingId(row.id);
    setForm({
      item_code: row.item_code ?? "",
      name: row.name ?? "",
      item_type: row.item_type,
      category_id: row.category_id ? String(row.category_id) : "",
      subcategory_id: row.subcategory_id ? String(row.subcategory_id) : "",
      unit_id: row.unit_id ? String(row.unit_id) : "",
      description: row.description ?? "",
      brand: row.brand ?? "",
      model: row.model ?? "",
      minimum_stock_level: toNumericString(row.minimum_stock_level),
      is_capitalizable: toBoolean(row.is_capitalizable),
      is_sensitive_controlled: toBoolean(row.is_sensitive_controlled),
      requires_serial_tracking: toBoolean(row.requires_serial_tracking),
      requires_batch_tracking: toBoolean(row.requires_batch_tracking),
      requires_expiry_tracking: toBoolean(row.requires_expiry_tracking),
      attributes: row.attributes ?? {},
      status: row.status === "inactive" ? "inactive" : "active",
    });
    setError("");
    setMessage("");
    setDialogOpen(true);
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
      const payload = {
        item_code: form.item_code.trim(),
        name: form.name.trim(),
        item_type: form.item_type,
        category_id: Number(form.category_id),
        subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : null,
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
        attributes: form.attributes,
        status: form.status,
      };

      if (editingId) {
        await api.put(`/master-data/items/${editingId}`, payload, authHeaders);
      } else {
        await api.post("/master-data/items", payload, authHeaders);
      }

      setDialogOpen(false);
      setEditingId(null);
      setForm(createInitialForm());
      setMessage(editingId ? "Item updated successfully." : "Item created successfully.");
      await loadRows();
    } catch {
      setError("Unable to save item. Verify required fields, duplicate code, and backend connectivity.");
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
      key: "subcategory_id",
      header: "Subcategory",
      render: (row: ItemRow) => formatLookup(lookups["asset-categories"], row.subcategory_id),
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
    {
      key: "actions",
      header: "Actions",
      className: "text-end",
      render: (row: ItemRow) => (
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => startEditing(row)}>
          Edit
        </button>
      ),
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
            <SearchableSelect id="item-filter-type" value={typeFilter} options={itemTypeOptions} onChange={setTypeFilter} placeholder="Search type" />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Status</label>
            <SearchableSelect id="item-filter-status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} placeholder="Search status" />
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
                      <h5 className="modal-title mb-1">{editingId ? "Edit Item" : "Create Item"}</h5>
                      <div className="small text-secondary">{editingId ? "Update the selected item master record." : "Add consumables, assets, controlled items, licenses, or project inventory."}</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <FieldLabel required info={infoText.itemCode}>Item Code</FieldLabel>
                        <input
                          className="form-control form-control-sm"
                          value={form.item_code}
                          onChange={(event) => setFormField("item_code", event.target.value)}
                          placeholder="e.g. IT-LAP-001"
                          required
                        />
                      </div>
                      <div className="col-12 col-md-8">
                        <FieldLabel required info={infoText.itemName}>Item Name</FieldLabel>
                        <input
                          className="form-control form-control-sm"
                          value={form.name}
                          onChange={(event) => setFormField("name", event.target.value)}
                          placeholder="e.g. Laptop Computer"
                          required
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel required info={infoText.itemType}>Item Type</FieldLabel>
                        <SearchableSelect id="item-type" value={form.item_type} options={activeItemTypeOptions} onChange={(value) => setFormField("item_type", value as ItemType)} placeholder="Search item type" />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel required info={infoText.category}>Category</FieldLabel>
                        <SearchableSelect id="item-category" value={form.category_id} options={categorySelectOptions} onChange={selectCategory} placeholder="Search category" />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={infoText.subcategory}>Subcategory</FieldLabel>
                        <SearchableSelect
                          id="item-subcategory"
                          value={form.subcategory_id}
                          options={subcategorySelectOptions}
                          onChange={(value) => setFormField("subcategory_id", value)}
                          placeholder={!form.category_id ? "Choose category first" : "Search subcategory"}
                          emptyLabel="No subcategories configured."
                          disabled={!form.category_id || subcategoryOptions.length === 0}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel required info={infoText.unit}>Unit of Measure</FieldLabel>
                        <SearchableSelect id="item-unit" value={form.unit_id} options={unitSelectOptions} onChange={(value) => setFormField("unit_id", value)} placeholder="Search UoM" />
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
                        <FieldLabel info={infoText.minimumStock}>Minimum Stock Level</FieldLabel>
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
                      <AttributeFields
                        definitions={lookups["asset-attribute-definitions"]}
                        categoryId={form.category_id}
                        subcategoryId={form.subcategory_id}
                        appliesTo="item"
                        values={form.attributes}
                        onChange={(code, value) => setForm((current) => ({
                          ...current,
                          attributes: { ...current.attributes, [code]: value },
                        }))}
                      />
                      <div className="col-12">
                        <div className="row g-2">
                          {[
                            ["is_capitalizable", "Capitalizable", infoText.capitalizable],
                            ["is_sensitive_controlled", "Sensitive / Controlled", infoText.sensitive],
                            ["requires_serial_tracking", "Serial Tracking", infoText.serial],
                            ["requires_batch_tracking", "Batch Tracking", infoText.batch],
                            ["requires_expiry_tracking", "Expiry Tracking", infoText.expiry],
                          ].map(([key, label, info]) => (
                            <div className="col-12 col-md-4" key={key}>
                              <div className="form-check">
                                <input
                                  id={`item-${key}`}
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={Boolean(form[key as keyof ItemFormState])}
                                  onChange={(event) => setFormField(key as keyof ItemFormState, event.target.checked as never)}
                                />
                                <FieldLabel htmlFor={`item-${key}`} check info={info}>{label}</FieldLabel>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={infoText.status}>Status</FieldLabel>
                        <SearchableSelect id="item-status" value={form.status} options={activeStatusOptions} onChange={(value) => setFormField("status", value as ItemFormState["status"])} placeholder="Search status" />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeDialog}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving || !authReady}>
                      <i className="bi bi-plus-circle me-1" />
                      {saving ? "Saving..." : editingId ? "Update Item" : "Create Item"}
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
