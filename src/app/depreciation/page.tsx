"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "departments" | "items" | "research-projects";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type DepreciationRow = {
  id: number;
  depreciation_run_id: number;
  run_no: string;
  period_start: string;
  period_end: string;
  run_type: string;
  run_status: string;
  calculated_at: string | null;
  opening_book_value: number;
  depreciation_amount: number;
  accumulated_depreciation_after: number;
  closing_book_value: number;
  useful_life_years: number | null;
  method: string;
  asset_id: number;
  asset_tag: string;
  printable_tag_id: string | null;
  item_code: string;
  item_name: string;
  department_id: number;
  department_name: string;
  project_id: number | null;
  project_title: string | null;
  asset_status: string;
};

const runStatusOptions = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "closed", label: "Closed" },
];

const toMoney = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value.includes("T") ? (value.split("T")[0] ?? "-") : value;
};

const initialLookups: Record<LookupKey, RowData[]> = {
  departments: [],
  items: [],
  "research-projects": [],
};

export default function DepreciationPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const [rows, setRows] = useState<DepreciationRow[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>(initialLookups);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("Load depreciation report to begin.");

  const authHeaders = useMemo(() => ({}), []);

  const loadRows = useCallback(async () => {
    if (!authReady) return;

    try {
      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department_id = departmentFilter;
      if (itemFilter) params.item_id = itemFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (dateFromFilter) params.date_from = dateFromFilter;
      if (dateToFilter) params.date_to = dateToFilter;

      const response = await api.get("/reports/depreciation", {
        ...authHeaders,
        params,
      });

      const payload = response.data?.data;
      setRows(Array.isArray(payload) ? payload : []);
      setMessage("Depreciation loaded.");
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load depreciation. Verify token and backend connectivity.");
      setMessage("");
    }
  }, [
    authReady,
    search,
    statusFilter,
    departmentFilter,
    itemFilter,
    projectFilter,
    dateFromFilter,
    dateToFilter,
    authHeaders,
  ]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    const next = {
      ...initialLookups,
    } as Record<LookupKey, RowData[]>;

    const loadable = [
      { key: "departments", path: "departments" },
      { key: "items", path: "items" },
      { key: "research-projects", path: "research-projects" },
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
  }, [authReady, authHeaders]);

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
    setProjectFilter("");
    setDateFromFilter("");
    setDateToFilter("");

    setTimeout(() => {
      void loadRows();
    }, 0);
  };

  const tableColumns = [
    {
      key: "run_no",
      header: "Run No",
      render: (row: DepreciationRow) => (
        <>
          <div className="fw-semibold">{row.run_no}</div>
          <small className="text-secondary">{row.run_type}</small>
        </>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (row: DepreciationRow) => (
        <>
          <div>{toDate(row.period_start)}</div>
          <small className="text-secondary">to {toDate(row.period_end)}</small>
        </>
      ),
    },
    {
      key: "asset",
      header: "Asset",
      render: (row: DepreciationRow) => (
        <>
          <div>{row.asset_tag}</div>
          <small className="text-secondary">{row.printable_tag_id ?? "-"}</small>
        </>
      ),
    },
    {
      key: "item",
      header: "Item",
      render: (row: DepreciationRow) => (
        <>
          <div>{row.item_code}</div>
          <small className="text-secondary">{row.item_name}</small>
        </>
      ),
    },
    { key: "department_name", header: "Department", render: (row: DepreciationRow) => <>{row.department_name}</> },
    { key: "run_status", header: "Status", render: (row: DepreciationRow) => <StatusBadge status={row.run_status} /> },
    { key: "opening_book_value", header: "Opening", render: (row: DepreciationRow) => toMoney(row.opening_book_value) },
    { key: "depreciation_amount", header: "Depreciation", render: (row: DepreciationRow) => toMoney(row.depreciation_amount) },
    {
      key: "accumulated_depreciation_after",
      header: "Accumulated After",
      render: (row: DepreciationRow) => toMoney(row.accumulated_depreciation_after),
    },
    { key: "closing_book_value", header: "Closing", render: (row: DepreciationRow) => toMoney(row.closing_book_value) },
    { key: "method", header: "Method", render: (row: DepreciationRow) => <>{row.method}</> },
    {
      key: "useful_life_years",
      header: "Useful Life",
      render: (row: DepreciationRow) => <>{row.useful_life_years ?? "-"}</>,
    },
    { key: "calculated_at", header: "Calculated At", render: (row: DepreciationRow) => <>{toDate(row.calculated_at)}</> },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Depreciation"
          subtitle="Review straight-line depreciation entries, period totals, and run status by asset."
          
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
              {runStatusOptions.map((status) => (
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

        <DataTable columns={tableColumns} rows={rows} empty="No depreciation entries found." />
      </div>
    </main>
  );
}
