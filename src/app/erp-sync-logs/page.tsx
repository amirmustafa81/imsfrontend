"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader } from "@/components/ims";

type SyncLog = {
  id: number;
  sync_type: string;
  endpoint_url: string | null;
  status: "success" | "failed" | "partial";
  records_received: number | null;
  records_created: number | null;
  records_updated: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type SyncLogForm = {
  sync_type: string;
  endpoint_url: string;
  status: "success" | "failed" | "partial" | "";
  records_received: string;
  records_created: string;
  records_updated: string;
  error_message: string;
  started_at: string;
  completed_at: string;
};

const emptyForm: SyncLogForm = {
  sync_type: "",
  endpoint_url: "",
  status: "",
  records_received: "",
  records_created: "",
  records_updated: "",
  error_message: "",
  started_at: "",
  completed_at: "",
};

export default function ErpSyncLogsPage() {
  const storedToken = useMemo(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""), []);
  const [token] = useState(storedToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [rows, setRows] = useState<SyncLog[]>([]);
  const [form, setForm] = useState<SyncLogForm>(emptyForm);
  const [filters, setFilters] = useState({ status: "", sync_type: "", fromDate: "", toDate: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    if (!token) return;

    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.sync_type) params.sync_type = filters.sync_type;
    if (filters.fromDate) params.from_date = filters.fromDate;
    if (filters.toDate) params.to_date = filters.toDate;

    try {
      const response = await api.get<{ data: SyncLog[] }>("/erp-sync-logs", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load sync logs.");
    }
  }, [token, headers, filters.status, filters.sync_type, filters.fromDate, filters.toDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const saveLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Authentication token required.");
      return;
    }

    if (!form.sync_type || !form.status) {
      setError("Sync type and status are required.");
      return;
    }

    try {
      await api.post(
        "/erp-sync-logs",
        {
          sync_type: form.sync_type,
          endpoint_url: form.endpoint_url || null,
          status: form.status,
          records_received: form.records_received ? Number(form.records_received) : null,
          records_created: form.records_created ? Number(form.records_created) : null,
          records_updated: form.records_updated ? Number(form.records_updated) : null,
          error_message: form.error_message || null,
          started_at: form.started_at || null,
          completed_at: form.completed_at || null,
        },
        headers,
      );
      setForm(emptyForm);
      setMessage("ERP sync log saved.");
      await loadRows();
    } catch {
      setError("Unable to save sync log.");
    }
  };

  const columns = [
    { key: "sync_type", header: "Sync Type" },
    { key: "status", header: "Status" },
    { key: "endpoint_url", header: "Endpoint" },
    { key: "records_received", header: "Received" },
    { key: "records_created", header: "Created" },
    { key: "records_updated", header: "Updated" },
    { key: "started_at", header: "Started" },
    { key: "completed_at", header: "Completed" },
    {
      key: "error_message",
      header: "Error",
      render: (row: SyncLog) => <span className="small">{row.error_message || "-"}</span>,
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="ERP Sync Logs"
          subtitle="Track data synchronization jobs and run audit history."
          
        />

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {message ? <div className="alert alert-success">{message}</div> : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <form className="card border-0 shadow-sm" onSubmit={saveLog}>
              <div className="card-header bg-white fw-semibold">Log New ERP Sync</div>
              <div className="card-body row g-3">
                <div className="col-12">
                  <label className="form-label small">Sync Type</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.sync_type}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setForm((current) => ({ ...current, sync_type: event.target.value }))}
                  >
                    <option value="">Select type</option>
                    <option value="employees">Employees</option>
                    <option value="departments">Departments</option>
                    <option value="designations">Designations</option>
                    <option value="projects">Projects</option>
                    <option value="locations">Locations</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small">Endpoint</label>
                  <input
                    className="form-control form-control-sm"
                    value={form.endpoint_url}
                    onChange={(event) => setForm((current) => ({ ...current, endpoint_url: event.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small">Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.status}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setForm((current) => ({ ...current, status: event.target.value as SyncLogForm["status"] }))
                    }
                  >
                    <option value="">Select status</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Received</label>
                  <input
                    className="form-control form-select form-select-sm"
                    type="number"
                    value={form.records_received}
                    onChange={(event) => setForm((current) => ({ ...current, records_received: event.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Created</label>
                  <input
                    className="form-control form-select form-select-sm"
                    type="number"
                    value={form.records_created}
                    onChange={(event) => setForm((current) => ({ ...current, records_created: event.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Updated</label>
                  <input
                    className="form-control form-select form-select-sm"
                    type="number"
                    value={form.records_updated}
                    onChange={(event) => setForm((current) => ({ ...current, records_updated: event.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small">Started at</label>
                  <input
                    className="form-control form-control-sm"
                    type="datetime-local"
                    value={form.started_at}
                    onChange={(event) => setForm((current) => ({ ...current, started_at: event.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small">Completed at</label>
                  <input
                    className="form-control form-control-sm"
                    type="datetime-local"
                    value={form.completed_at}
                    onChange={(event) => setForm((current) => ({ ...current, completed_at: event.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small">Error Message</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.error_message}
                    onChange={(event) => setForm((current) => ({ ...current, error_message: event.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <button className="btn btn-sm btn-primary" type="submit">
                    <i className="bi bi-plus-circle me-1" />
                    Log Sync
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setFilters({ status: "", sync_type: "", fromDate: "", toDate: "" })}>
              <div className="col-12 col-md-3">
                <label className="form-label small mb-1">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small mb-1">Sync Type</label>
                <input
                  className="form-control form-control-sm"
                  value={filters.sync_type}
                  onChange={(event) => setFilters((current) => ({ ...current, sync_type: event.target.value }))}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small mb-1">From</label>
                <input
                  className="form-control form-control-sm"
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small mb-1">To</label>
                <input
                  className="form-control form-control-sm"
                  type="date"
                  value={filters.toDate}
                  onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                />
              </div>
            </FilterBar>

            {rows.length === 0 ? (
              <EmptyState title="No sync logs" message="No ERP sync history found." />
            ) : (
              <DataTable columns={columns} rows={rows} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
