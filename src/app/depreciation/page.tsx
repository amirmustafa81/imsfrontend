"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

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

const statusClass: Record<string, string> = {
  draft: "text-bg-secondary",
  posted: "text-bg-primary",
  closed: "text-bg-success",
};

export default function DepreciationPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
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

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typeof window === "undefined") return;

    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
    setError("");
    setMessage("Token saved. Loading depreciation report.");
  };

  const loadRows = useCallback(async () => {
    if (!token) return;

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
    token,
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
    if (!token) return;

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
  }, [token, authHeaders]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const badgeClass = (status: string | undefined) => statusClass[String(status ?? "")] ?? "text-bg-light text-dark";

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
                <h1 className="h3 mb-2">Depreciation</h1>
                <p className="text-secondary mb-0">
                  Review straight-line depreciation entries, period totals, and run status by asset.
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
                <input
                  className="form-control"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="col-md-3 col-lg-2">
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {runStatusOptions.map((status) => (
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
                <input
                  type="date"
                  className="form-control"
                  value={dateToFilter}
                  onChange={(event) => setDateToFilter(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0">Depreciation Entries</h2>
            <span className="text-secondary">{rows.length} rows</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Run No</th>
                    <th>Period</th>
                    <th>Asset</th>
                    <th>Item</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Opening</th>
                    <th>Depreciation</th>
                    <th>Accumulated After</th>
                    <th>Closing</th>
                    <th>Method</th>
                    <th>Useful Life</th>
                    <th>Calculated At</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center text-secondary">
                        No depreciation entries found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="fw-semibold">{row.run_no}</div>
                          <small className="text-secondary">{row.run_type}</small>
                        </td>
                        <td>
                          <div>{toDate(row.period_start)}</div>
                          <small className="text-secondary">to {toDate(row.period_end)}</small>
                        </td>
                        <td>
                          <div>{row.asset_tag}</div>
                          <small className="text-secondary">{row.printable_tag_id ?? "-"}</small>
                        </td>
                        <td>
                          <div>{row.item_code}</div>
                          <small className="text-secondary">{row.item_name}</small>
                        </td>
                        <td>{row.department_name}</td>
                        <td>
                          <span className={`badge ${badgeClass(row.run_status)}`}>{row.run_status}</span>
                        </td>
                        <td>{toMoney(row.opening_book_value)}</td>
                        <td>{toMoney(row.depreciation_amount)}</td>
                        <td>{toMoney(row.accumulated_depreciation_after)}</td>
                        <td>{toMoney(row.closing_book_value)}</td>
                        <td>{row.method}</td>
                        <td>{row.useful_life_years ?? "-"}</td>
                        <td>{toDate(row.calculated_at)}</td>
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
