"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type SyncLog = {
  id: number;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_received: number;
  records_created: number;
  records_updated: number;
  error_message: string | null;
  endpoint_url: string | null;
};

const syncTypeOptions = [
  { value: "", label: "All" },
  { value: "employees", label: "Employees" },
  { value: "departments", label: "Departments" },
  { value: "designations", label: "Designations" },
  { value: "projects", label: "Projects" },
  { value: "locations", label: "Locations" },
  { value: "other", label: "Other" },
];

export default function ExportHistoryPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tempToken, setTempToken] = useState(token);
  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const [syncType, setSyncType] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const statusOptions = [
    { value: "", label: "All" },
    { value: "success", label: "Success" },
    { value: "failed", label: "Failed" },
    { value: "partial", label: "Partial" },
  ];

  const loadRows = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ data: SyncLog[] }>("/erp-sync-logs", {
        ...authHeaders,
        params: {
          ...(syncType ? { sync_type: syncType } : {}),
          ...(status ? { status } : {}),
          ...(fromDate ? { from_date: fromDate } : {}),
          ...(toDate ? { to_date: toDate } : {}),
        },
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load export history. Verify token and backend support.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, fromDate, status, syncType, toDate, token]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tempToken);
    setToken(tempToken);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const reset = () => {
    setSyncType("");
    setStatus("");
    setFromDate("");
    setToDate("");
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Export History"
          subtitle="ERP sync history and export lifecycle audit (backend integration events)."
          actions={
            <form className="d-flex gap-2" onSubmit={submitToken}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-key" />
                </span>
                <input
                  className="form-control"
                  placeholder="Bearer token"
                  value={tempToken}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTempToken(event.target.value)}
                />
              </div>
              <button className="btn btn-sm btn-outline-primary" type="submit">
                Save token
              </button>
            </form>
          }
        />

        <FilterBar onReset={reset}>
          <div className="col-12 col-md-2">
            <label className="form-label small mb-1">Type</label>
            <select className="form-select form-select-sm" value={syncType} onChange={(event) => setSyncType(event.target.value)}>
              {syncTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small mb-1">From</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small mb-1">To</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <DataTable
          columns={[
            { key: "sync_type", header: "Type" },
            { key: "status", header: "Status", render: (row: SyncLog) => <StatusBadge status={row.status} /> },
            { key: "started_at", header: "Started" },
            { key: "completed_at", header: "Completed" },
            { key: "records_received", header: "Received", className: "text-end" },
            { key: "records_created", header: "Created", className: "text-end" },
            { key: "records_updated", header: "Updated", className: "text-end" },
            { key: "error_message", header: "Error" },
          ]}
          rows={rows}
          empty="No export or sync history found."
        />

        {loading ? <span className="small text-secondary">Loading…</span> : null}
      </div>
    </main>
  );
}
