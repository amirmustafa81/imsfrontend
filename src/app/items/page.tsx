"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
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

export default function ItemsPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tempToken, setTempToken] = useState(token);
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

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const loadLookups = useCallback(async () => {
    if (!token) {
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
  }, [authHeaders, token, lookups]);

  const loadRows = useCallback(async () => {
    if (!token) {
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
  }, [authHeaders, search, statusFilter, token]);

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

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tempToken);
    setToken(tempToken);
    setMessage("Token saved. Loading item master...");
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
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
            <form className="d-flex gap-2 align-items-end" onSubmit={submitToken}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-key" />
                </span>
                <input
                  className="form-control"
                  placeholder="Bearer token"
                  value={tempToken}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTempToken(event.target.value)}
                  type="password"
                />
              </div>
              <button className="btn btn-sm btn-outline-primary" type="submit">
                Save token
              </button>
            </form>
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
        {!token ? <div className="alert alert-info">Save token to load live items.</div> : null}
        {message ? <div className="alert alert-light border-0">{message}</div> : null}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Item master list</h2>
          {loading ? <span className="small text-secondary">Loading…</span> : null}
        </div>

        <DataTable columns={columns} rows={filteredRows} empty="No items found." />
      </div>
    </main>
  );
}
