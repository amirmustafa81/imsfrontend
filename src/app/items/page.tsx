"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AttributeFields, type AttributeDefinition, type AttributeValues } from "@/components/ims/AttributeFields";
import { DataTable, FieldLabel, FilterBar, PageHeader, PaginationControls, SearchableSelect, StatusBadge, type SearchableSelectOption } from "@/components/ims";

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
  status?: string;
};

type LookupMap = {
  "asset-categories": Lookup[];
  "units-of-measure": Lookup[];
  "asset-attribute-definitions": AttributeDefinition[];
};

type QuickMasterResource = "category" | "subcategory" | "unit";

type QuickMasterForm = {
  code: string;
  name: string;
  parent_category_id: string;
  useful_life_years: string;
  depreciation_method: "straight_line" | "reducing_balance" | "none";
  capitalization_threshold: string;
  is_sensitive_controlled: boolean;
  requires_serial_tracking: boolean;
  requires_qr_tag: boolean;
  status: "active" | "inactive";
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

const DEFAULT_PAGE_SIZE = 25;

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

const isActiveLookup = (row: Lookup): boolean => (row.status ?? "").toLowerCase() !== "inactive";

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

const createQuickMasterForm = (resource: QuickMasterResource, currentForm: ItemFormState): QuickMasterForm => ({
  code: "",
  name: "",
  parent_category_id: resource === "subcategory" ? currentForm.category_id : "",
  useful_life_years: "",
  depreciation_method: "none",
  capitalization_threshold: "",
  is_sensitive_controlled: false,
  requires_serial_tracking: false,
  requires_qr_tag: false,
  status: "active",
});

const infoText = {
  itemCode: "Auto-generated from category, subcategory, and the next 4-digit serial number.",
  itemName: "Official item name shown to users in lists, transactions, receipts, and reports.",
  itemType: "Controls how the item behaves, such as consumable stock, fixed asset, controlled stationery, project inventory, or license.",
  category: "Main classification used for reporting, coding, depreciation policy, and item grouping.",
  subcategory: "More specific classification under the selected category, used for consistent item and asset coding.",
  unit: "Base stock unit used for stock balance, issue, return, and consumption quantities.",
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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Load data to begin.");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemFormState>(createInitialForm);
  const [quickMasterOpen, setQuickMasterOpen] = useState(false);
  const [quickMasterResource, setQuickMasterResource] = useState<QuickMasterResource>("category");
  const [quickMasterForm, setQuickMasterForm] = useState<QuickMasterForm>(() => createQuickMasterForm("category", createInitialForm()));
  const [quickMasterSaving, setQuickMasterSaving] = useState(false);
  const [quickMasterError, setQuickMasterError] = useState("");

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

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, categoryFilter, subcategoryFilter]);

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
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
    setQuickMasterOpen(false);
    setQuickMasterSaving(false);
    setQuickMasterError("");
  };

  const setFormField = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openQuickMasterDialog = (resource: QuickMasterResource) => {
    setQuickMasterResource(resource);
    setQuickMasterForm(createQuickMasterForm(resource, form));
    setQuickMasterError("");
    setQuickMasterOpen(true);
  };

  const closeQuickMasterDialog = () => {
    setQuickMasterOpen(false);
    setQuickMasterSaving(false);
    setQuickMasterError("");
  };

  const setQuickMasterField = <K extends keyof QuickMasterForm>(key: K, value: QuickMasterForm[K]) => {
    setQuickMasterForm((current) => ({ ...current, [key]: value }));
  };

  const parentCategories = useMemo(
    () => lookups["asset-categories"].filter((category) => !category.parent_category_id && isActiveLookup(category)),
    [lookups],
  );

  const selectedCategory = useMemo(
    () => parentCategories.find((category) => String(category.id) === form.category_id),
    [form.category_id, parentCategories],
  );

  const selectedFilterCategory = useMemo(
    () => parentCategories.find((category) => String(category.id) === categoryFilter),
    [categoryFilter, parentCategories],
  );

  const subcategoryOptions = useMemo(
    () =>
      selectedCategory
        ? lookups["asset-categories"].filter(
            (category) =>
              String(category.parent_category_id ?? "") === String(selectedCategory.id) && isActiveLookup(category),
          )
        : [],
    [lookups, selectedCategory],
  );
  const filterSubcategoryOptions = useMemo(
    () =>
      lookups["asset-categories"].filter((category) => {
        if (!category.parent_category_id || !isActiveLookup(category)) {
          return false;
        }

        return selectedFilterCategory
          ? String(category.parent_category_id) === String(selectedFilterCategory.id)
          : true;
      }),
    [lookups, selectedFilterCategory],
  );
  const categorySelectOptions = useMemo(() => parentCategories.map(toLookupOption), [parentCategories]);
  const subcategorySelectOptions = useMemo(() => subcategoryOptions.map(toLookupOption), [subcategoryOptions]);
  const filterSubcategorySelectOptions = useMemo(
    () => filterSubcategoryOptions.map(toLookupOption),
    [filterSubcategoryOptions],
  );
  const unitSelectOptions = useMemo(() => lookups["units-of-measure"].map(toLookupOption), [lookups]);
  const activeItemTypeOptions = useMemo(
    () => itemTypeOptions.filter((option) => option.value) as SearchableSelectOption[],
    [],
  );
  const activeStatusOptions = useMemo(
    () => statusOptions.filter((option) => option.value) as SearchableSelectOption[],
    [],
  );
  const generatedItemCode = useMemo(() => {
    if (editingId) {
      return form.item_code;
    }

    const category = lookups["asset-categories"].find((lookup) => String(lookup.id) === form.category_id);
    if (!category?.code) {
      return "";
    }

    const subcategory = form.subcategory_id
      ? lookups["asset-categories"].find((lookup) => String(lookup.id) === form.subcategory_id)
      : null;
    const codeSegments = [category.code, subcategory?.code].filter(Boolean).map((segment) =>
      String(segment)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    );
    const prefix = codeSegments.filter(Boolean).join("-");

    if (!prefix) {
      return "";
    }

    const maxSequence = rows.reduce((max, row) => {
      if (!row.item_code.startsWith(`${prefix}-`)) {
        return max;
      }

      const match = row.item_code.match(/-(\d{4})$/);
      if (!match) {
        return max;
      }

      return Math.max(max, Number(match[1]));
    }, 0);

    return `${prefix}-${String(maxSequence + 1).padStart(4, "0")}`;
  }, [editingId, form.category_id, form.item_code, form.subcategory_id, lookups, rows]);

  const selectCategory = (categoryId: string) => {
    setForm((current) => ({
      ...current,
      category_id: categoryId,
      subcategory_id: "",
      attributes: {},
    }));
  };

  const selectCategoryFilter = (categoryId: string) => {
    setCategoryFilter(categoryId);
    setSubcategoryFilter("");
  };

  const reloadMasterLookup = async (endpoint: keyof LookupMap) => {
    const response = await api.get<{ data: Lookup[] }>(`/master-data/${endpoint}`, authHeaders);
    const payload = Array.isArray(response.data?.data) ? response.data.data : [];
    setLookups((current) => ({ ...current, [endpoint]: payload }));
    return payload;
  };

  const validateQuickMaster = () => {
    if (quickMasterResource === "subcategory") {
      return Boolean(quickMasterForm.code.trim() && quickMasterForm.name.trim() && quickMasterForm.parent_category_id);
    }

    return Boolean(quickMasterForm.code.trim() && quickMasterForm.name.trim());
  };

  const quickMasterPayload = () => {
    if (quickMasterResource === "unit") {
      return {
        code: quickMasterForm.code.trim(),
        name: quickMasterForm.name.trim(),
        status: quickMasterForm.status,
      };
    }

    return {
      code: quickMasterForm.code.trim(),
      name: quickMasterForm.name.trim(),
      parent_category_id: quickMasterResource === "subcategory" ? Number(quickMasterForm.parent_category_id) : null,
      useful_life_years: quickMasterForm.useful_life_years ? Number(quickMasterForm.useful_life_years) : null,
      depreciation_method: quickMasterForm.depreciation_method,
      capitalization_threshold: quickMasterForm.capitalization_threshold ? Number(quickMasterForm.capitalization_threshold) : null,
      is_sensitive_controlled: quickMasterForm.is_sensitive_controlled,
      requires_serial_tracking: quickMasterForm.requires_serial_tracking,
      requires_qr_tag: quickMasterForm.requires_qr_tag,
      status: quickMasterForm.status,
    };
  };

  const saveQuickMaster = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setQuickMasterError("Please sign in before creating master data records.");
      return;
    }

    if (!validateQuickMaster()) {
      setQuickMasterError("Code and Name are required. Subcategory also requires a parent category.");
      return;
    }

    setQuickMasterSaving(true);
    setQuickMasterError("");

    try {
      const endpoint = quickMasterResource === "unit" ? "units-of-measure" : "asset-categories";
      const response = await api.post<{ data?: Lookup }>(`/master-data/${endpoint}`, quickMasterPayload(), authHeaders);
      const created = response.data?.data;
      const nextRows = await reloadMasterLookup(endpoint);
      const createdRow = created?.id
        ? created
        : nextRows.find((row) => String(row.code ?? "").toLowerCase() === quickMasterForm.code.trim().toLowerCase());

      if (createdRow?.id) {
        if (quickMasterResource === "category") {
          selectCategory(String(createdRow.id));
        } else if (quickMasterResource === "subcategory") {
          setFormField("subcategory_id", String(createdRow.id));
        } else {
          setFormField("unit_id", String(createdRow.id));
        }
      }

      setMessage(`${quickMasterResource === "unit" ? "Unit of Measure" : quickMasterResource === "subcategory" ? "Subcategory" : "Category"} created and selected.`);
      setError("");
      setQuickMasterOpen(false);
    } catch {
      setQuickMasterError("Unable to create record. Verify required fields and duplicate code.");
    } finally {
      setQuickMasterSaving(false);
    }
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
        item_code: editingId ? form.item_code.trim() : generatedItemCode,
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
    const normalizedCategory = categoryFilter.trim();
    const normalizedSubcategory = subcategoryFilter.trim();

    return rows.filter((row) => {
      if (normalizedType && row.item_type !== normalizedType) {
        return false;
      }

      if (normalizedCategory && String(row.category_id ?? "") !== normalizedCategory) {
        return false;
      }

      if (normalizedSubcategory && String(row.subcategory_id ?? "") !== normalizedSubcategory) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, rows, subcategoryFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

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
      header: "Base UOM",
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

  const quickMasterTitle =
    quickMasterResource === "unit" ? "Unit of Measure" : quickMasterResource === "subcategory" ? "Subcategory" : "Category";

  const renderQuickMasterFields = () => (
    <div className="row g-3">
      <div className="col-12 col-md-4">
        <FieldLabel required>Code</FieldLabel>
        <input
          className="form-control form-control-sm"
          value={quickMasterForm.code}
          onChange={(event) => setQuickMasterField("code", event.target.value)}
          placeholder={quickMasterResource === "unit" ? "e.g. EACH" : "e.g. IT"}
          required
        />
      </div>
      <div className="col-12 col-md-8">
        <FieldLabel required>Name</FieldLabel>
        <input
          className="form-control form-control-sm"
          value={quickMasterForm.name}
          onChange={(event) => setQuickMasterField("name", event.target.value)}
          placeholder={quickMasterResource === "unit" ? "e.g. Each" : "e.g. IT Equipment"}
          required
        />
      </div>

      {quickMasterResource === "subcategory" ? (
        <div className="col-12 col-md-8">
          <FieldLabel required>Parent Category</FieldLabel>
          <SearchableSelect
            id="item-quick-subcategory-parent"
            value={quickMasterForm.parent_category_id}
            options={categorySelectOptions}
            onChange={(value) => setQuickMasterField("parent_category_id", value)}
            placeholder="Search parent category"
          />
        </div>
      ) : null}

      {quickMasterResource !== "unit" ? (
        <>
          <div className="col-12 col-md-4">
            <label className="form-label small">Useful Life Years</label>
            <input
              className="form-control form-control-sm"
              type="number"
              min="0"
              step="0.01"
              value={quickMasterForm.useful_life_years}
              onChange={(event) => setQuickMasterField("useful_life_years", event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="item-quick-category-status"
              value={quickMasterForm.status}
              options={activeStatusOptions}
              onChange={(value) => setQuickMasterField("status", value as QuickMasterForm["status"])}
              placeholder="Search status"
            />
          </div>
          <div className="col-12">
            <div className="row g-2">
              {[
                ["is_sensitive_controlled", "Sensitive / Controlled"],
                ["requires_serial_tracking", "Serial Tracking"],
                ["requires_qr_tag", "QR Tag Required"],
              ].map(([key, label]) => (
                <div className="col-12 col-md-4" key={key}>
                  <div className="form-check">
                    <input
                      id={`item-quick-${key}`}
                      className="form-check-input"
                      type="checkbox"
                      checked={Boolean(quickMasterForm[key as keyof QuickMasterForm])}
                      onChange={(event) => setQuickMasterField(key as keyof QuickMasterForm, event.target.checked as never)}
                    />
                    <label className="form-check-label small" htmlFor={`item-quick-${key}`}>
                      {label}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="col-12 col-md-4">
          <label className="form-label small">Status</label>
          <SearchableSelect
            id="item-quick-unit-status"
            value={quickMasterForm.status}
            options={activeStatusOptions}
            onChange={(value) => setQuickMasterField("status", value as QuickMasterForm["status"])}
            placeholder="Search status"
          />
        </div>
      )}
    </div>
  );

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
          <div className="col-12 col-lg-3">
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
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Category</label>
            <SearchableSelect
              id="item-filter-category"
              value={categoryFilter}
              options={[{ value: "", label: "All categories" }, ...categorySelectOptions]}
              onChange={selectCategoryFilter}
              placeholder="Search category"
              emptyLabel="No active categories configured."
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Subcategory</label>
            <SearchableSelect
              id="item-filter-subcategory"
              value={subcategoryFilter}
              options={[{ value: "", label: "All subcategories" }, ...filterSubcategorySelectOptions]}
              onChange={setSubcategoryFilter}
              placeholder={categoryFilter ? "Search subcategory" : "All subcategories"}
              emptyLabel="No active subcategories configured."
            />
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {!authReady ? <div className="alert alert-info">Authentication token required to load live items.</div> : null}
        {message ? <div className="alert alert-light border-0">{message}</div> : null}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Item master list</h2>
          {loading ? <span className="small text-secondary">Loading…</span> : null}
        </div>

        <DataTable columns={columns} rows={paginatedRows} empty="No items found." />
        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={filteredRows.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />

        {dialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div
                className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                style={{ width: "min(78vw, 1280px)", maxWidth: "min(78vw, 1280px)", maxHeight: "calc(100vh - 2rem)" }}
              >
                <form className="modal-content border-0 shadow-lg" style={{ maxHeight: "calc(100vh - 2rem)" }} onSubmit={saveItem}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">{editingId ? "Edit Item" : "Create Item"}</h5>
                      <div className="small text-secondary">{editingId ? "Update the selected item master record." : "Add consumables, assets, controlled items, licenses, or project inventory."}</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                  </div>
                  <div className="modal-body px-4 py-4" style={{ overflowY: "auto" }}>
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <FieldLabel required info={infoText.itemCode}>Item Code</FieldLabel>
                        <input
                          className="form-control form-control-sm"
                          value={editingId ? form.item_code : generatedItemCode}
                          placeholder={form.category_id ? "Auto-generating..." : "Select category first"}
                          readOnly
                          required
                        />
                        {!editingId ? <div className="form-text">Generated as Category-Subcategory-0001 when saved.</div> : null}
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
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <FieldLabel required info={infoText.category}>Category</FieldLabel>
                          <button className="btn btn-link btn-sm p-0 text-decoration-none" type="button" onClick={() => openQuickMasterDialog("category")}>
                            <i className="bi bi-plus-circle me-1" />
                            New Category
                          </button>
                        </div>
                        <SearchableSelect id="item-category" value={form.category_id} options={categorySelectOptions} onChange={selectCategory} placeholder="Search category" />
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <FieldLabel info={infoText.subcategory}>Subcategory</FieldLabel>
                          <button
                            className="btn btn-link btn-sm p-0 text-decoration-none"
                            type="button"
                            onClick={() => openQuickMasterDialog("subcategory")}
                            disabled={!form.category_id}
                            title={form.category_id ? "Create subcategory under selected category" : "Choose category before adding subcategory"}
                          >
                            <i className="bi bi-plus-circle me-1" />
                            New Subcategory
                          </button>
                        </div>
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
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <FieldLabel required info={infoText.unit}>Base UOM / Stock UOM</FieldLabel>
                          <button className="btn btn-link btn-sm p-0 text-decoration-none" type="button" onClick={() => openQuickMasterDialog("unit")}>
                            <i className="bi bi-plus-circle me-1" />
                            New UoM
                          </button>
                        </div>
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
                        <label className="form-label small">Specification / Variant</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.model}
                          onChange={(event) => setFormField("model", event.target.value)}
                          placeholder="e.g. 500g, analytical grade, model/version"
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
                                <FieldLabel htmlFor={`item-${key}`} check info={info} infoPlacement="top">{label}</FieldLabel>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={infoText.status} infoPlacement="top">Status</FieldLabel>
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
            {quickMasterOpen ? (
              <>
                <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1080 }}>
                  <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 720 }}>
                    <form className="modal-content border-0 shadow-lg" onSubmit={saveQuickMaster}>
                      <div className="modal-header px-4 py-3">
                        <div>
                          <h3 className="modal-title h5 mb-1">Add {quickMasterTitle}</h3>
                          <div className="small text-secondary">Create the missing master data record and select it for this item.</div>
                        </div>
                        <button className="btn-close" type="button" aria-label="Close" onClick={closeQuickMasterDialog} />
                      </div>
                      <div className="modal-body px-4 py-4">
                        {quickMasterError ? <div className="alert alert-danger py-2">{quickMasterError}</div> : null}
                        {renderQuickMasterFields()}
                      </div>
                      <div className="modal-footer px-4 py-3">
                        <button className="btn btn-outline-secondary" type="button" onClick={closeQuickMasterDialog}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={quickMasterSaving || !authReady}>
                          <i className="bi bi-check2-square me-1" />
                          {quickMasterSaving ? "Saving..." : `Create & Select ${quickMasterTitle}`}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="modal-backdrop fade show" style={{ zIndex: 1070 }} onClick={closeQuickMasterDialog} />
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
