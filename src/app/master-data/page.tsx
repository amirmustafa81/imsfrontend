"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, PageHeader } from "@/components/ims";

type ResourceKey =
  | "departments"
  | "buildings"
  | "rooms"
  | "stores"
  | "asset-categories"
  | "units-of-measure"
  | "funding-sources"
  | "suppliers"
  | "research-projects";

type FieldType = "text" | "number" | "select" | "textarea" | "checkbox" | "date";

type Option = { value: string; label: string };

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  source?: ResourceKey;
};

type ResourceDef = {
  label: string;
  endpoint: string;
  tableColumns: string[];
  fields: FieldDef[];
};

type RowData = {
  id: number;
  [key: string]: unknown;
};

type FormState = Record<string, string | number | boolean | null>;

const resources: Record<ResourceKey, ResourceDef> = {
  departments: {
    label: "Departments",
    endpoint: "departments",
    tableColumns: ["id", "code", "name", "department_type", "status"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "erp_department_id", label: "ERP Department ID", type: "text" },
      { key: "department_type", label: "Type", type: "select", required: true, options: [
        { value: "academic", label: "Academic" },
        { value: "administrative", label: "Administrative" },
        { value: "store", label: "Store" },
        { value: "laboratory", label: "Laboratory" },
        { value: "hostel", label: "Hostel" },
        { value: "transport", label: "Transport" },
        { value: "maintenance", label: "Maintenance" },
        { value: "other", label: "Other" },
      ] },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
      { key: "last_synced_at", label: "Last Synced", type: "date" },
    ],
  },
  buildings: {
    label: "Buildings",
    endpoint: "buildings",
    tableColumns: ["id", "code", "name", "status"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  rooms: {
    label: "Rooms",
    endpoint: "rooms",
    tableColumns: ["id", "code", "building_id", "name", "status"],
    fields: [
      { key: "building_id", label: "Building", type: "select", required: true, source: "buildings" },
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text" },
      { key: "floor", label: "Floor", type: "text" },
      { key: "department_id", label: "Department", type: "select", source: "departments" },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  stores: {
    label: "Stores",
    endpoint: "stores",
    tableColumns: ["id", "code", "name", "store_type", "status"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "department_id", label: "Department", type: "select", required: true, source: "departments" },
      { key: "building_id", label: "Building", type: "select", source: "buildings" },
      { key: "room_id", label: "Room", type: "select", source: "rooms" },
      { key: "store_type", label: "Type", type: "select", options: [
        { value: "central", label: "Central" },
        { value: "departmental", label: "Departmental" },
        { value: "laboratory", label: "Laboratory" },
        { value: "examination", label: "Examination" },
        { value: "project", label: "Project" },
        { value: "other", label: "Other" },
      ], required: true },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  "asset-categories": {
    label: "Asset Categories",
    endpoint: "asset-categories",
    tableColumns: ["id", "code", "name", "depreciation_method", "status"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "parent_category_id", label: "Parent Category", type: "select", source: "asset-categories" },
      { key: "useful_life_years", label: "Useful Life Years", type: "number" },
      { key: "depreciation_method", label: "Depreciation", type: "select", required: true, options: [
        { value: "straight_line", label: "Straight Line" },
        { value: "reducing_balance", label: "Reducing Balance" },
        { value: "none", label: "None" },
      ] },
      { key: "capitalization_threshold", label: "Capitalization Threshold", type: "number" },
      { key: "is_sensitive_controlled", label: "Sensitive", type: "select", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
      { key: "requires_serial_tracking", label: "Requires Serial", type: "select", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
      { key: "requires_qr_tag", label: "Requires QR Tag", type: "select", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  "units-of-measure": {
    label: "Units of Measure",
    endpoint: "units-of-measure",
    tableColumns: ["id", "code", "name", "status"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  "funding-sources": {
    label: "Funding Sources",
    endpoint: "funding-sources",
    tableColumns: ["id", "code", "name", "sponsor_type", "status"],
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "sponsor_type", label: "Sponsor Type", type: "select", options: [
        { value: "university", label: "University" },
        { value: "government", label: "Government" },
        { value: "hec", label: "HEC" },
        { value: "psf", label: "PSF" },
        { value: "donor", label: "Donor" },
        { value: "industry", label: "Industry" },
        { value: "international", label: "International" },
        { value: "other", label: "Other" },
      ] },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  suppliers: {
    label: "Suppliers",
    endpoint: "suppliers",
    tableColumns: ["id", "name", "phone", "email", "status"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "ntn", label: "NTN", type: "text" },
      { key: "contact_person", label: "Contact Person", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    ],
  },
  "research-projects": {
    label: "Research Projects",
    endpoint: "research-projects",
    tableColumns: ["id", "project_code", "title", "project_category", "status"],
    fields: [
      { key: "project_code", label: "Project Code", type: "text", required: true },
      { key: "title", label: "Project Title", type: "text", required: true },
      { key: "sponsor", label: "Sponsor", type: "text" },
      { key: "project_category", label: "Category", type: "select", required: true, options: [
        { value: "hec_nrpu", label: "HEC NRPU" },
        { value: "psf", label: "PSF" },
        { value: "internal_grant", label: "Internal Grant" },
        { value: "donor_project", label: "Donor Project" },
        { value: "industry_project", label: "Industry Project" },
        { value: "international_collaboration", label: "International Collaboration" },
        { value: "student_fyp", label: "Student FYP" },
        { value: "other", label: "Other" },
      ] },
      { key: "department_id", label: "Department", type: "select", source: "departments" },
      { key: "funding_source_id", label: "Funding Source", type: "select", source: "funding-sources" },
      { key: "cost_center_code", label: "Cost Center", type: "text" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: [
        { value: "active", label: "Active" },
        { value: "closed", label: "Closed" },
        { value: "suspended", label: "Suspended" },
        { value: "cancelled", label: "Cancelled" },
      ] },
    ],
  },
};

const resourceEntries = Object.entries(resources) as [ResourceKey, ResourceDef][];

const initialFormFor = (fields: FieldDef[]): FormState =>
  fields.reduce<FormState>((acc, field) => {
    acc[field.key] = field.type === "checkbox" ? false : "";
    return acc;
  }, {});

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
};

const toDateInput = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.split("T")[0] ?? "";
  }

  return String(value);
};

export default function MasterDataPage() {
  const storedToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");

  const [activeResource, setActiveResource] = useState<ResourceKey>("departments");
  const [rows, setRows] = useState<RowData[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(initialFormFor(resources["departments"].fields));
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [token] = useState(storedToken);
  const [lookups, setLookups] = useState<Record<ResourceKey, RowData[]>>({
    departments: [],
    buildings: [],
    rooms: [],
    stores: [],
    "asset-categories": [],
    "units-of-measure": [],
    "funding-sources": [],
    suppliers: [],
    "research-projects": [],
  });

  const definition = resources[activeResource];
  const configColumns = definition.tableColumns;

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  useEffect(() => {
    const loadRows = async () => {
      if (!token) {
        setRows([]);
        return;
      }

      try {
        const query: Record<string, string> = {};

        if (statusFilter) {
          query.status = statusFilter;
        }

        if (search.trim()) {
          query.search = search.trim();
        }

        const response = await api.get(`/master-data/${definition.endpoint}`, {
          ...authHeaders,
          params: query,
        });

        const data = response.data?.data;
        setRows(Array.isArray(data) ? data : []);
        setError("");
      } catch {
        setRows([]);
        setError("Unable to load records. Verify token and route availability.");
      }
    };

    const reload = async () => {
      await loadRows();
    };

    void reload();
  }, [activeResource, definition.endpoint, authHeaders, search, statusFilter, token]);

  useEffect(() => {
    if (!token) return;

    const loadLookup = async () => {
      const required: ResourceKey[] = ["departments", "buildings", "rooms", "asset-categories", "funding-sources"];
      const updates: Array<Promise<void>> = [];
      const copy: Record<ResourceKey, RowData[]> = {
        departments: [],
        buildings: [],
        rooms: [],
        stores: [],
        "asset-categories": [],
        "units-of-measure": [],
        "funding-sources": [],
        suppliers: [],
        "research-projects": [],
      };

      for (const resource of required) {
        updates.push(
          api
            .get(`/master-data/${resource}`, { headers: authHeaders.headers })
            .then((response) => {
              const rows = response.data?.data;
              if (Array.isArray(rows)) {
                copy[resource] = rows;
              }
            })
            .catch(() => {
              copy[resource] = [];
            }),
        );
      }

      await Promise.all(updates);
      setLookups(copy);
    };

    void loadLookup();
  }, [token, authHeaders]);

  const getLookupLabel = (source: ResourceKey, value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";

    const matches = lookups[source]?.find((item) => item.id === value);
    if (!matches) return String(value);

    return `${matches.code ?? matches.project_code ?? matches.id} - ${matches.name ?? matches.title ?? ""}`;
  };

  const setFieldValue = (key: string, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setNumericOrBlank = (key: string, value: string) => {
    if (value === "") {
      setFieldValue(key, "");
      return;
    }

    setFieldValue(key, String(Number(value)));
  };

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Authentication token required.");
      return;
    }

    const payload: Record<string, unknown> = {};

    for (const field of definition.fields) {
      const raw = form[field.key];

      if (raw === "" || raw === null || raw === undefined) {
        continue;
      }

      if (field.type === "number") {
        payload[field.key] = Number(raw);
        continue;
      }

      if (field.type === "checkbox") {
        payload[field.key] = Boolean(raw);
        continue;
      }

      payload[field.key] = String(raw);

      if ((field.type === "select") && (field.key.endsWith("_id") || field.key === "parent_category_id")) {
        payload[field.key] = Number(raw);
      }
    }

    try {
      if (editingId) {
        await api.put(`/master-data/${definition.endpoint}/${editingId}`, payload, authHeaders);
        setMessage("Record updated successfully");
      } else {
        await api.post(`/master-data/${definition.endpoint}`, payload, authHeaders);
        setMessage("Record created successfully");
      }

      const response = await api.get(`/master-data/${definition.endpoint}`, {
        ...authHeaders,
        params: {
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        },
      });

      const nextRows = response.data?.data;
      setRows(Array.isArray(nextRows) ? nextRows : []);
      setError("");
      setEditingId(null);
      setForm(initialFormFor(definition.fields));
    } catch {
      setError("Could not save record. Check required fields and values.");
    }
  };

  const startEditing = (row: RowData) => {
    const next = initialFormFor(definition.fields);

    for (const field of definition.fields) {
      const value = row[field.key];

      if (value === null || value === undefined) {
        continue;
      }

      if (field.type === "date" && typeof value === "string") {
        next[field.key] = toDateInput(value);
        continue;
      }

      if (typeof value === "boolean") {
        next[field.key] = value;
        continue;
      }

      if (typeof value === "number") {
        next[field.key] = value;
      } else {
        next[field.key] = String(value);
      }
    }

    setEditingId(typeof row.id === "number" ? row.id : Number(row.id));
    setForm(next);
  };

  const deactivateRecord = async (row: RowData) => {
    if (!token) {
      setError("Authentication token required.");
      return;
    }

    try {
      await api.delete(`/master-data/${definition.endpoint}/${row.id}`, authHeaders);
      setMessage("Record deactivated");
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch {
      setError("Could not deactivate this record.");
    }
  };

  const renderInput = (field: FieldDef) => {
    const value = form[field.key] ?? "";

    if (field.type === "textarea") {
      return (
        <textarea
          className="form-control"
          rows={3}
          value={typeof value === "boolean" ? (value ? "1" : "0") : String(value)}
          onChange={(event) => setFieldValue(field.key, event.target.value)}
        />
      );
    }

    if (field.type === "select") {
      const options = (() => {
        if (field.options) return field.options;
        if (!field.source) return [];

        const list = lookups[field.source] ?? [];
        return list.map((row) => ({
          value: String(row.id),
          label: `${row.code ?? row.project_code ?? row.id} - ${row.name ?? row.title ?? ""}`,
        }));
      })();

      return (
        <select
          className="form-select"
          value={String(value)}
          onChange={(event) => setFieldValue(field.key, event.target.value)}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "checkbox") {
      return (
        <input
          type="checkbox"
          className="form-check-input"
          checked={Boolean(value)}
          onChange={(event) => setFieldValue(field.key, event.target.checked ? "1" : "0")}
        />
      );
    }

    return (
      <input
        className="form-control"
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={String(value)}
        onChange={(event) =>
          field.type === "number"
            ? setNumericOrBlank(field.key, event.target.value)
            : setFieldValue(field.key, event.target.value)
        }
      />
    );
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  const tableColumns = [
    ...configColumns.map((column) => ({
      key: column,
      header: column.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      render: (row: RowData) => {
        const isRelational =
          [
            "department_id",
            "building_id",
            "room_id",
            "funding_source_id",
            "parent_department_id",
            "parent_category_id",
            "department_type",
          ].includes(column);

        if (isRelational) {
          const source: ResourceKey =
            column === "department_id" || column === "parent_department_id"
              ? "departments"
              : column === "building_id"
                ? "buildings"
                : column === "room_id"
                  ? "rooms"
                  : column === "funding_source_id"
                    ? "funding-sources"
                    : "asset-categories";

          return <>{getLookupLabel(source, row[column])}</>;
        }

        return <>{displayValue(row[column])}</>;
      },
    })),
    {
      key: "actions",
      header: "Actions",
      className: "text-end",
      render: (row: RowData) => (
        <div className="d-flex gap-2 justify-content-end">
          <button
            className="btn btn-sm btn-outline-primary"
            type="button"
            onClick={() => startEditing(row)}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            type="button"
            onClick={() => deactivateRecord(row)}
          >
            Deactivate
          </button>
        </div>
      ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Master Data Console"
          subtitle="Create, edit, and deactivate master records used across IMS modules."
          
        />

        {(error || message || !token) && (
          <div className="mb-3">
            {error && <div className="alert alert-danger mb-0">{error}</div>}
            {message && <div className="alert alert-success mb-0">{message}</div>}
            {!token && <div className="alert alert-warning mb-0">Authentication token required before loading records.</div>}
          </div>
        )}

        <div className="mb-4">
          <div className="mb-3">
            <label className="form-label">Resource</label>
            <div className="d-flex flex-wrap gap-2">
              {resourceEntries.map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-sm ${activeResource === key ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => {
                    setActiveResource(key);
                    setEditingId(null);
                    setForm(initialFormFor(resources[key].fields));
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <FilterBar onReset={clearFilters}>
            <div className="col-12 col-md-3">
              <label className="form-label small">Status</label>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small">Search</label>
              <input
                className="form-control form-control-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search common fields"
              />
            </div>
          </FilterBar>
        </div>

        <div className="row g-4">
          <div className="col-12 col-xl-7">
            <DataTable columns={tableColumns as never} rows={(token ? rows : []) as never} empty="No records found." />
          </div>

          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h2 className="h5">{editingId ? "Edit" : "Add New"} {definition.label}</h2>
                <form onSubmit={submitRecord}>
                  <div className="row g-3">
                    {definition.fields.map((field) => (
                      <div
                        key={field.key}
                        className={field.type === "textarea" || field.type === "text" ? "col-12" : "col-12 col-md-6"}
                      >
                        <label className="form-label">
                          {field.label}
                          {field.required ? <span className="text-danger"> *</span> : null}
                        </label>
                        {renderInput(field)}
                      </div>
                    ))}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-primary" type="submit" disabled={!token}>
                      {editingId ? "Update Record" : "Save Record"}
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setForm(initialFormFor(definition.fields));
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
