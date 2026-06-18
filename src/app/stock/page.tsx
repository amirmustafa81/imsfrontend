"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Lookup = {
  id: number;
  name: string;
};

type StockRow = {
  id: number;
  item_code: string;
  item_name: string;
  category_name: string;
  department_name: string;
  store_name: string;
  project_code: string;
  funding_source_code: string;
  minimum_stock_level: number;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  status: string;
  [key: string]: string | number | undefined;
};

type Filters = {
  search: string;
  department_id: string;
  store_id: string;
  project_id: string;
};

const reportColumns = [
  { key: "item_code", header: "Item Code" },
  { key: "item_name", header: "Item Name" },
  { key: "category_name", header: "Category" },
  { key: "department_name", header: "Department" },
  { key: "store_name", header: "Store" },
  { key: "minimum_stock_level", header: "Minimum", className: "text-end" },
  { key: "quantity_on_hand", header: "On Hand", className: "text-end" },
  { key: "quantity_reserved", header: "Reserved", className: "text-end" },
  { key: "available_quantity", header: "Available", className: "text-end" },
  { key: "project_code", header: "Project" },
  { key: "funding_source_code", header: "Funding" },
];

export default function StockPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [reportType, setReportType] = useState<"stock_balance" | "low_stock">("stock_balance");

  const [filter, setFilter] = useState<Filters>({
    search: "",
    department_id: "",
    store_id: "",
    project_id: "",
  });

  const [rows, setRows] = useState<StockRow[]>([]);
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [stores, setStores] = useState<Lookup[]>([]);
  const [projects, setProjects] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const setFilterField = useCallback(
    (field: keyof Filters, value: string) => {
      setFilter((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilter({ search: "", department_id: "", store_id: "", project_id: "" });
  }, []);

  const loadLookups = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    try {
      const [departmentsResponse, storesResponse, projectsResponse] = await Promise.all([
        api.get("/master-data/departments"),
        api.get("/master-data/stores"),
        api.get("/master-data/research-projects"),
      ]);

      setDepartments(departmentsResponse.data);
      setStores(storesResponse.data);
      setProjects(projectsResponse.data);
    } catch {
      setError("Unable to load lookup data. Please check token and backend connectivity.");
    }
  }, [authLoading, isAuthenticated]);

  const loadReportRows = useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params: Record<string, string> = {};
      if (filter.search.trim()) {
        params.search = filter.search.trim();
      }
      if (filter.department_id) {
        params.department_id = filter.department_id;
      }
      if (filter.store_id) {
        params.store_id = filter.store_id;
      }
      if (filter.project_id) {
        params.project_id = filter.project_id;
      }

      const response = await api.get<{ data: StockRow[] }>(`/reports/${reportType}`, {
        params,
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Failed to load stock report. Verify token and endpoint availability.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, filter, reportType, isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReportRows();
  }, [loadReportRows]);

  const totalRows = useMemo(() => {
    const availableTotal = rows.reduce((sum, row) => sum + Number(row.available_quantity || 0), 0);
    const onHandTotal = rows.reduce((sum, row) => sum + Number(row.quantity_on_hand || 0), 0);
    return { availableTotal, onHandTotal, count: rows.length };
  }, [rows]);

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Stock Balances"
          subtitle="Monitor stock balance, low-stock warnings, and report-level filters."
        />

        {!isAuthenticated && !authLoading ? (
          <div className="alert alert-info mb-3">
            <i className="bi bi-shield-lock me-2" />
            Log in to load stock report data.
          </div>
        ) : null}

        <div className="row g-2 mb-3">
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-secondary">Rows</div>
                <div className="fs-4 fw-bold">{totalRows.count}</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-secondary">Total On Hand</div>
                <div className="fs-4 fw-bold">{totalRows.onHandTotal.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-secondary">Total Available</div>
                <div className="fs-4 fw-bold">{totalRows.availableTotal.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <FilterBar onReset={resetFilters}>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Report</label>
            <select
              className="form-select form-select-sm"
              value={reportType}
              onChange={(event) => setReportType(event.target.value as "stock_balance" | "low_stock")}
            >
              <option value="stock_balance">Stock Balance</option>
              <option value="low_stock">Low Stock</option>
            </select>
          </div>

          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Search</label>
            <input
              className="form-control form-control-sm"
              value={filter.search}
              placeholder="Item, code or department"
              onChange={(event) => setFilterField("search", event.target.value)}
            />
          </div>

          <div className="col-12 col-lg-2">
            <label className="form-label small mb-1">Department</label>
            <select
              className="form-select form-select-sm"
              value={filter.department_id}
              onChange={(event) => setFilterField("department_id", event.target.value)}
            >
              <option value="">All</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-lg-2">
            <label className="form-label small mb-1">Store</label>
            <select
              className="form-select form-select-sm"
              value={filter.store_id}
              onChange={(event) => setFilterField("store_id", event.target.value)}
            >
              <option value="">All</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-lg-2">
            <label className="form-label small mb-1">Project</label>
            <select
              className="form-select form-select-sm"
              value={filter.project_id}
              onChange={(event) => setFilterField("project_id", event.target.value)}
            >
              <option value="">All</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">
            {reportType === "stock_balance" ? "Current stock balance" : "Low-stock alerts"}
          </h2>
          {loading ? <span className="small text-secondary">Loading…</span> : null}
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <DataTable
          columns={
            reportType === "stock_balance"
                  ? reportColumns
                  : [
                  ...reportColumns.slice(0, 4),
                  { key: "minimum_stock_level", header: "Minimum", className: "text-end" },
                  { key: "quantity_on_hand", header: "Available", className: "text-end" },
                  { key: "status", header: "Status", render: (row: StockRow) => <StatusBadge status={row.status || "Active"} /> },
                ]
          }
          rows={rows}
          empty={
            reportType === "stock_balance"
              ? "No stock balance rows match current filters."
              : "No low-stock rows match current filters."
          }
          rowClassName={() => ""}
        />

        {!isAuthenticated || authLoading ? (
          <div className="alert alert-info mb-0 mt-3">Log in to connect the live API.</div>
        ) : null}
      </div>
    </main>
  );
}
