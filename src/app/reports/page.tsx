"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type ReportType = "controlled_stationery_batches" | "controlled_stationery_serials" | "controlled_stationery_movements";

type LookupKey = "departments" | "stores" | "items" | "research-projects";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined | Date;
};

type ReportFilters = {
  search: string;
  date_from: string;
  date_to: string;
  status: string;
  item_id: string;
  department_id: string;
  store_id: string;
  project_id: string;
  batch_id: string;
  serial_id: string;
  movement_type: string;
};

type ReportColumn = {
  key: string;
  label: string;
};

type ReportConfig = {
  title: string;
  subtitle: string;
  endpoint: string;
  columns: ReportColumn[];
  showStatus: boolean;
  showProject: boolean;
  showStore: boolean;
};

const reportConfigs: Record<ReportType, ReportConfig> = {
  controlled_stationery_batches: {
    title: "Controlled Stationery Batch Register",
    subtitle: "Batch summary grouped by receipt batch and department.",
    endpoint: "/reports/controlled-stationery/batches",
    showStatus: true,
    showProject: false,
    showStore: true,
    columns: [
      { key: "batch_no", label: "Batch No" },
      { key: "item_name", label: "Item" },
      { key: "serial_prefix", label: "Serial Prefix" },
      { key: "serial_from", label: "Serial From" },
      { key: "serial_to", label: "Serial To" },
      { key: "total_quantity", label: "Quantity" },
      { key: "department_name", label: "Department" },
      { key: "store_name", label: "Store" },
      { key: "status", label: "Status" },
      { key: "serials_count", label: "Serials Count" },
      { key: "received_date", label: "Received Date" },
      { key: "remarks", label: "Remarks" },
    ],
  },
  controlled_stationery_serials: {
    title: "Controlled Stationery Serial Register",
    subtitle: "Item-level serial movement readiness and current location.",
    endpoint: "/reports/controlled-stationery/serials",
    showStatus: true,
    showProject: true,
    showStore: true,
    columns: [
      { key: "serial_no", label: "Serial No" },
      { key: "batch_no", label: "Batch No" },
      { key: "item_name", label: "Item" },
      { key: "current_department_name", label: "Department" },
      { key: "current_store_name", label: "Store" },
      { key: "issued_to_user_name", label: "Custodian" },
      { key: "project_name", label: "Project" },
      { key: "status", label: "Status" },
      { key: "issued_at", label: "Issued At" },
      { key: "consumed_at", label: "Consumed At" },
      { key: "remarks", label: "Remarks" },
    ],
  },
  controlled_stationery_movements: {
    title: "Controlled Stationery Movement History",
    subtitle: "Serial-wise issue/consume/return and transfer history.",
    endpoint: "/reports/controlled-stationery/movements",
    showStatus: false,
    showProject: false,
    showStore: false,
    columns: [
      { key: "movement_date", label: "Date" },
      { key: "serial_no", label: "Serial No" },
      { key: "batch_no", label: "Batch No" },
      { key: "item_name", label: "Item" },
      { key: "movement_type", label: "Movement Type" },
      { key: "from_department_name", label: "From" },
      { key: "to_department_name", label: "To" },
      { key: "transaction_no", label: "Transaction" },
      { key: "user_name", label: "User" },
      { key: "remarks", label: "Remarks" },
    ],
  },
};

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "in_stock", label: "In Stock" },
  { value: "issued", label: "Issued" },
  { value: "consumed", label: "Consumed" },
  { value: "missing", label: "Missing" },
  { value: "damaged", label: "Damaged" },
];

const movementTypeOptions = [
  { value: "", label: "All Types" },
  { value: "receive", label: "Receive" },
  { value: "issue", label: "Issue" },
  { value: "consume", label: "Consume" },
  { value: "return", label: "Return" },
  { value: "mark_missing", label: "Mark Missing" },
  { value: "mark_damaged", label: "Mark Damaged" },
  { value: "cancel", label: "Cancel" },
];

const emptyLookups: Record<LookupKey, RowData[]> = {
  departments: [],
  stores: [],
  items: [],
  "research-projects": [],
};

const emptyFilters: ReportFilters = {
  search: "",
  date_from: "",
  date_to: "",
  status: "",
  item_id: "",
  department_id: "",
  store_id: "",
  project_id: "",
  batch_id: "",
  serial_id: "",
  movement_type: "",
};

const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
};

const toDisplayDate = (value: unknown): string => {
  if (!value) return "-";
  const iso = String(value);
  return iso.includes("T") ? iso.split("T")[0] ?? "-" : iso;
};

const buildFilterPayload = (report: ReportType, filters: ReportFilters): Record<string, string> => {
  const payload: Record<string, string> = {};
  if (filters.search.trim()) payload.search = filters.search.trim();
  if (filters.date_from) payload.date_from = filters.date_from;
  if (filters.date_to) payload.date_to = filters.date_to;
  if (filters.status) payload.status = filters.status;
  if (filters.item_id) payload.item_id = filters.item_id;
  if (filters.department_id) payload.department_id = filters.department_id;
  if (filters.store_id) payload.store_id = filters.store_id;
  if (filters.project_id && report === "controlled_stationery_serials") payload.project_id = filters.project_id;
  if (filters.batch_id && report === "controlled_stationery_serials") payload.batch_id = filters.batch_id;
  if (filters.serial_id && report === "controlled_stationery_movements") payload.serial_id = filters.serial_id;
  if (filters.movement_type && report === "controlled_stationery_movements") payload.movement_type = filters.movement_type;

  return payload;
};

export default function ReportsPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [activeReport, setActiveReport] = useState<ReportType>("controlled_stationery_batches");
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>(emptyLookups);
  const [filters, setFilters] = useState<Record<ReportType, ReportFilters>>({
    controlled_stationery_batches: { ...emptyFilters },
    controlled_stationery_serials: { ...emptyFilters },
    controlled_stationery_movements: { ...emptyFilters },
  });
  const [rows, setRows] = useState<RowData[]>([]);
  const [message, setMessage] = useState("Load a report to begin.");
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const reportConfig = reportConfigs[activeReport];
  const currentFilters = filters[activeReport];

  const lookupLabel = useCallback((rows: RowData[], value: unknown, fallback?: string) => {
    if (value === null || value === undefined || value === "") return fallback ?? "-";
    const match = rows.find((row) => String(row.id) === String(value));
    if (!match) return String(value);
    if ("code" in match) return `${match.code} - ${match.name ?? ""}`;
    if ("project_code" in match) return `${match.project_code} - ${match.title ?? ""}`;
    return String(match.name ?? match.title ?? match.id);
  }, []);

  const loadLookups = useCallback(async () => {
    if (!token) return;

    const next = { ...emptyLookups };
    const loadables: LookupKey[] = ["departments", "stores", "items", "research-projects"];

    await Promise.all(
      loadables.map(async (key) => {
        const response = await api.get(`/master-data/${key}`, { ...authHeaders });
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[key] = payload;
        }
      }),
    );

    setLookups(next);
  }, [authHeaders, token]);

  const loadRows = useCallback(async () => {
    if (!token) return;

    try {
      const payload = buildFilterPayload(activeReport, currentFilters);
      const response = await api.get(reportConfig.endpoint, {
        ...authHeaders,
        params: payload,
      });
      const data = response.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setError("");
      setMessage(`${reportConfig.title} loaded`);
    } catch {
      setRows([]);
      setMessage("");
      setError("Failed to load report. Verify token and endpoint availability.");
    }
  }, [token, authHeaders, activeReport, reportConfig.endpoint, reportConfig.title, currentFilters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  const saveToken = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
    setMessage("Token saved. Refreshing report.");
    setError("");
    setTimeout(() => {
      void loadRows();
      void loadLookups();
    }, 50);
  };

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [activeReport]: {
        ...current[activeReport],
        [key]: value,
      },
    }));
  };

  const resetFilters = () => {
    setFilters((current) => ({
      ...current,
      [activeReport]: { ...emptyFilters },
    }));
    setError("");
    setMessage("Filters reset.");
  };

  const exportExcel = async () => {
    if (!token) {
      setError("Please save your token before exporting.");
      return;
    }

    try {
      const payload = buildFilterPayload(activeReport, currentFilters);
      const response = await api.post(
        "/reports/controlled-stationery/export",
        {
          report: activeReport,
          format: "excel",
          ...payload,
        },
        {
          ...authHeaders,
          responseType: "blob",
        },
      );

      const fileName = `ims_${activeReport}_${new Date().toISOString().slice(0, 19).replace(":", "-").replace(":", "-")}.csv`;
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setMessage("CSV export download started.");
      setError("");
    } catch {
      setError("Excel export failed. Try again or reduce filters.");
    }
  };

  const exportPdf = () => {
    if (rows.length === 0) {
      setError("No rows to export. Select a report with data.");
      return;
    }

    const headerCells = reportConfig.columns
      .map((column) => `<th style=\"padding:6px 8px; border:1px solid #cdd1d5; text-align:left;\">${escapeHtml(column.label)}</th>`)
      .join("");
    const bodyRows = rows
      .map((row) => {
        const rowMarkup = reportConfig.columns
          .map((column) => {
            const raw = row[column.key];
            const value = column.key.includes("at") ? toDisplayDate(raw) : raw;
            return `<td style=\"padding:6px 8px; border:1px solid #cdd1d5;\">${escapeHtml(value)}</td>`;
          })
          .join("");
        return `<tr>${rowMarkup}</tr>`;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>${escapeHtml(reportConfig.title)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 24px; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            .muted { color: #6c757d; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th { background: #f8f9fa; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(reportConfig.title)}</h1>
          <div class=\"muted\">Export generated at ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Unable to open print window. Check your browser pop-up settings.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setMessage("PDF print prepared.");
    setError("");
  };

  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
          <Link href="/" className="btn btn-link px-0">
            <i className="bi bi-arrow-left me-2" />
            Dashboard
          </Link>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-success" type="button" onClick={exportExcel}>
              <i className="bi bi-file-earmark-excel me-2" />
              Export Excel
            </button>
            <button className="btn btn-outline-primary" type="button" onClick={exportPdf}>
              <i className="bi bi-file-earmark-pdf me-2" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-end mb-3">
              <div>
                <h1 className="h3 mb-1">Reports</h1>
                <p className="text-secondary mb-0">{reportConfig.subtitle}</p>
              </div>

              <div className="d-flex flex-wrap gap-2 align-items-start">
                <div className="input-group">
                  <span className="input-group-text">API Token</span>
                  <input
                    className="form-control"
                    type="text"
                    value={tmpToken}
                    onChange={(event) => setTmpToken(event.target.value)}
                    placeholder="Paste token"
                  />
                </div>
                <button className="btn btn-outline-secondary" type="button" onClick={saveToken}>
                  Save Token
                </button>
              </div>
            </div>

            <div className="mb-3">
              <div className="btn-group" role="group" aria-label="Report type">
                {(Object.keys(reportConfigs) as ReportType[]).map((reportKey) => (
                  <button
                    className={`btn ${activeReport === reportKey ? "btn-primary" : "btn-outline-primary"}`}
                    key={reportKey}
                    type="button"
                    onClick={() => {
                      setActiveReport(reportKey);
                      setError("");
                    }}
                  >
                    <i className="bi bi-bar-chart-line me-1" />
                    {reportConfigs[reportKey].title}
                  </button>
                ))}
              </div>
            </div>

            <div className="alert alert-light border">
              <i className="bi bi-graph-up me-2" />
              {reportConfig.title}
            </div>

            <div className="row g-2 align-items-end">
              <div className="col-12 col-lg-3">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control"
                  value={currentFilters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="batch_no, serial_no, remarks..."
                />
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label">Date From</label>
                <input
                  type="date"
                  className="form-control"
                  value={currentFilters.date_from}
                  onChange={(event) => updateFilter("date_from", event.target.value)}
                />
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label">Date To</label>
                <input
                  type="date"
                  className="form-control"
                  value={currentFilters.date_to}
                  onChange={(event) => updateFilter("date_to", event.target.value)}
                />
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={currentFilters.department_id}
                  onChange={(event) => updateFilter("department_id", event.target.value)}
                >
                  <option value="">All Departments</option>
                  {lookups.departments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {lookupLabel(lookups.departments, row.id, `${row.code} - ${row.name}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-lg-3">
                <label className="form-label">Item</label>
                <select
                  className="form-select"
                  value={currentFilters.item_id}
                  onChange={(event) => updateFilter("item_id", event.target.value)}
                >
                  <option value="">All Items</option>
                  {lookups.items.map((row) => (
                    <option key={row.id} value={row.id}>
                      {lookupLabel(lookups.items, row.id, row.name)}
                    </option>
                  ))}
                </select>
              </div>

              {reportConfig.showStatus && (
                <div className="col-6 col-lg-2">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={currentFilters.status}
                    onChange={(event) => updateFilter("status", event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reportConfig.showStore && (
                <div className="col-6 col-lg-2">
                  <label className="form-label">Store</label>
                  <select
                    className="form-select"
                    value={currentFilters.store_id}
                    onChange={(event) => updateFilter("store_id", event.target.value)}
                  >
                    <option value="">All Stores</option>
                    {lookups.stores.map((row) => (
                      <option key={row.id} value={row.id}>
                        {lookupLabel(lookups.stores, row.id, row.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reportConfig.showProject && (
                <div className="col-6 col-lg-3">
                  <label className="form-label">Project</label>
                  <select
                    className="form-select"
                    value={currentFilters.project_id}
                    onChange={(event) => updateFilter("project_id", event.target.value)}
                  >
                    <option value="">All Projects</option>
                    {lookups["research-projects"].map((row) => (
                      <option key={row.id} value={row.id}>
                        {lookupLabel(lookups["research-projects"], row.id, `${row.project_code} - ${row.title}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeReport === "controlled_stationery_serials" && (
                <div className="col-6 col-lg-2">
                  <label className="form-label">Batch</label>
                  <input
                    type="number"
                    className="form-control"
                    value={currentFilters.batch_id}
                    onChange={(event) => updateFilter("batch_id", event.target.value)}
                    min={1}
                    placeholder="Batch ID"
                  />
                </div>
              )}

              {activeReport === "controlled_stationery_movements" && (
                <>
                  <div className="col-6 col-lg-2">
                    <label className="form-label">Movement Type</label>
                    <select
                      className="form-select"
                      value={currentFilters.movement_type}
                      onChange={(event) => updateFilter("movement_type", event.target.value)}
                    >
                      {movementTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-lg-2">
                    <label className="form-label">Serial ID</label>
                    <input
                      type="number"
                      className="form-control"
                      value={currentFilters.serial_id}
                      onChange={(event) => updateFilter("serial_id", event.target.value)}
                      min={1}
                      placeholder="Serial ID"
                    />
                  </div>
                </>
              )}

              <div className="col-12 d-flex gap-2 justify-content-end mt-2">
                <button className="btn btn-outline-secondary" type="button" onClick={resetFilters}>
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
            <span>
              Results
              <span className="text-secondary fw-normal ms-2">({rows.length} rows)</span>
            </span>
            {(message || error) && (
              <span className={error ? "text-danger" : "text-success"}>{error || message}</span>
            )}
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  {reportConfig.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {reportConfig.columns.map((column) => {
                      const raw = row[column.key];
                      const isDate = column.key.includes("_at") || column.key.includes("date");
                      const value = isDate ? toDisplayDate(raw) : raw;
                      return <td key={`${row.id}-${column.key}`}>{value ?? "-"}</td>;
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="text-center text-secondary py-4" colSpan={reportConfig.columns.length}>
                      No rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
