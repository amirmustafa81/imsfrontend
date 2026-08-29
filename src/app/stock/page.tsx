"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, PaginationControls, StatusBadge } from "@/components/ims";

type Lookup = {
  id: number;
  name?: string;
  title?: string;
  code?: string;
  project_code?: string;
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
  base_uom_code?: string | null;
  base_uom_name?: string | null;
  last_receipt_uom_id?: number | null;
  last_receipt_uom_code?: string | null;
  last_receipt_uom_name?: string | null;
  last_qty_per_receipt_unit?: number | null;
  minimum_stock_level: number;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  status: string;
  [key: string]: string | number | null | undefined;
};

type Filters = {
  search: string;
  department_id: string;
  store_id: string;
  project_id: string;
};

type StockQuantityKey = "minimum_stock_level" | "quantity_on_hand" | "quantity_reserved" | "available_quantity";

const formatQuantity = (value: unknown): string => {
  const quantity = Number(value ?? 0);
  if (!Number.isFinite(quantity)) return "-";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(quantity);
};

const stockUnitCode = (value: unknown): string => String(value ?? "").trim();

const stockPackageCode = (row: StockRow): string => stockUnitCode(row.last_receipt_uom_code || row.last_receipt_uom_name);

const stockBaseCode = (row: StockRow): string => stockUnitCode(row.base_uom_code || row.base_uom_name);

const stockPackageSize = (row: StockRow): number => {
  const qtyPer = Number(row.last_qty_per_receipt_unit ?? 0);
  return Number.isFinite(qtyPer) && qtyPer > 0 ? qtyPer : 1;
};

const stockUsesPackageUnit = (row: StockRow): boolean => {
  const packageCode = stockPackageCode(row);
  const baseCode = stockBaseCode(row);

  return Boolean(packageCode && baseCode && packageCode !== baseCode && stockPackageSize(row) > 0);
};

const stockQuantityLabel = (row: StockRow, key: StockQuantityKey) => {
  const baseQuantity = Number(row[key] ?? 0);
  const baseCode = stockBaseCode(row);

  if (key === "minimum_stock_level" || baseQuantity === 0) {
    return (
      <span>
        {formatQuantity(baseQuantity)}
        {baseCode ? ` ${baseCode}` : ""}
      </span>
    );
  }

  if (stockUsesPackageUnit(row)) {
    const packageCode = stockPackageCode(row);
    const packageQuantity = baseQuantity / stockPackageSize(row);
    const shouldShowBaseCode = baseCode.toUpperCase() !== "EACH";

    return (
      <div className="stock-quantity-cell">
        <span>
          {formatQuantity(packageQuantity)} {packageCode}
        </span>
        <small>
          {formatQuantity(baseQuantity)}
          {shouldShowBaseCode && baseCode ? ` ${baseCode}` : ""}
        </small>
      </div>
    );
  }

  return (
    <span>
      {formatQuantity(baseQuantity)}
      {baseCode ? ` ${baseCode}` : ""}
    </span>
  );
};

const stockPackageLabel = (row: StockRow): string => {
  const packageCode = stockPackageCode(row);
  const baseCode = stockBaseCode(row);

  if (!packageCode || !baseCode || !stockUsesPackageUnit(row)) return "-";

  return `1 ${packageCode} = ${formatQuantity(stockPackageSize(row))} ${baseCode}`;
};

const reportColumns = [
  { key: "item_code", header: "Item Code" },
  { key: "item_name", header: "Item Name" },
  { key: "package_balance", header: "Package", render: (row: StockRow) => <span className="stock-package-label">{stockPackageLabel(row)}</span> },
  { key: "category_name", header: "Category" },
  { key: "department_name", header: "Department" },
  { key: "store_name", header: "Store" },
  { key: "minimum_stock_level", header: "Minimum", className: "text-end", render: (row: StockRow) => stockQuantityLabel(row, "minimum_stock_level") },
  { key: "quantity_on_hand", header: "On Hand", className: "text-end", render: (row: StockRow) => stockQuantityLabel(row, "quantity_on_hand") },
  { key: "quantity_reserved", header: "Reserved", className: "text-end", render: (row: StockRow) => stockQuantityLabel(row, "quantity_reserved") },
  { key: "available_quantity", header: "Available", className: "text-end", render: (row: StockRow) => stockQuantityLabel(row, "available_quantity") },
  { key: "project_code", header: "Project" },
  { key: "funding_source_code", header: "Funding" },
];

const reportEndpoints: Record<"stock_balance" | "low_stock", string> = {
  stock_balance: "stock-balance",
  low_stock: "low-stock",
};

const DEFAULT_PAGE_SIZE = 25;

const unwrapRows = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }

  return [];
};

const lookupLabel = (lookup: Lookup): string => lookup.name ?? lookup.title ?? lookup.project_code ?? lookup.code ?? String(lookup.id);

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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

      setDepartments(unwrapRows<Lookup>(departmentsResponse.data));
      setStores(unwrapRows<Lookup>(storesResponse.data));
      setProjects(unwrapRows<Lookup>(projectsResponse.data));
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

      const response = await api.get<{ data: StockRow[] }>(`/reports/${reportEndpoints[reportType]}`, {
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

  useEffect(() => {
    setPage(1);
  }, [filter, reportType]);

  const totalRows = useMemo(() => {
    const availableTotal = rows.reduce((sum, row) => sum + Number(row.available_quantity || 0), 0);
    const onHandTotal = rows.reduce((sum, row) => sum + Number(row.quantity_on_hand || 0), 0);
    return { availableTotal, onHandTotal, count: rows.length };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [currentPage, pageSize, rows]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

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
                <div className="fs-4 fw-bold">{formatQuantity(totalRows.onHandTotal)}</div>
                <div className="small text-secondary">Base stock units</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-secondary">Total Available</div>
                <div className="fs-4 fw-bold">{formatQuantity(totalRows.availableTotal)}</div>
                <div className="small text-secondary">Base stock units</div>
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
                  {lookupLabel(department)}
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
                  {lookupLabel(store)}
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
                  {lookupLabel(project)}
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
                  { key: "minimum_stock_level", header: "Minimum", className: "text-end", render: (row: StockRow) => stockQuantityLabel(row, "minimum_stock_level") },
                  { key: "available_quantity", header: "Available", className: "text-end", render: (row: StockRow) => stockQuantityLabel(row, "available_quantity") },
                  { key: "status", header: "Status", render: (row: StockRow) => <StatusBadge status={row.status || "Active"} /> },
                ]
          }
          rows={paginatedRows}
          empty={
            reportType === "stock_balance"
              ? "No stock balance rows match current filters."
              : "No low-stock rows match current filters."
          }
          rowClassName={() => ""}
        />
        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />

        {!isAuthenticated || authLoading ? (
          <div className="alert alert-info mb-0 mt-3">Log in to connect the live API.</div>
        ) : null}
      </div>
    </main>
  );
}
