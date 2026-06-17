"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type AuditLog = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  user_id: number | null;
  remarks: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
  };
};

type FilterState = {
  search: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  date_from: string;
  date_to: string;
};

const initialFilter: FilterState = {
  search: "",
  action: "",
  entity_type: "",
  entity_id: "",
  user_id: "",
  date_from: "",
  date_to: "",
};
export default function AuditLogsPage() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "",
  );
  const [tempToken, setTempToken] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "",
  );
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<FilterState>(initialFilter);
  const [message, setMessage] = useState("Load audit logs to continue.");
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const buildParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filter.search.trim()) {
      params.search = filter.search.trim();
    }

    if (filter.action.trim()) {
      params.action = filter.action.trim();
    }

    if (filter.entity_type.trim()) {
      params.entity_type = filter.entity_type.trim();
    }

    if (filter.entity_id.trim()) {
      params.entity_id = filter.entity_id.trim();
    }

    if (filter.user_id.trim()) {
      params.user_id = filter.user_id.trim();
    }

    if (filter.date_from.trim()) {
      params.date_from = filter.date_from.trim();
    }

    if (filter.date_to.trim()) {
      params.date_to = filter.date_to.trim();
    }

    return params;
  }, [filter]);

  const loadRows = useCallback(async () => {
    if (!token) return;

    try {
      const params = buildParams();
      const response = await api.get("/audit-logs", { ...authHeaders, params });
      const payload = response.data?.data;
      setLogs(Array.isArray(payload) ? payload : []);
      setError("");
      setMessage("Audit logs loaded.");
    } catch {
      setLogs([]);
      setError("Unable to load audit logs. Verify token and API connection.");
    }
  }, [authHeaders, buildParams, token]);

  useEffect(() => {
    void (async () => {
      await loadRows();
    })();
  }, [loadRows]);

  const saveToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typeof window === "undefined") return;
    localStorage.setItem("ims_api_token", tempToken);
    setToken(tempToken);
    setError("");
    setMessage("Token saved. Loading audit logs.");
  };

  const setValue = (key: keyof FilterState, value: string) => {
    setFilter((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilter(initialFilter);
    setTimeout(() => {
      void loadRows();
    }, 0);
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <h1 className="h3 mb-1">Audit Logs</h1>
            <p className="text-secondary mb-0">Track all auditable inventory actions with filters.</p>
          </div>
          <Link className="btn btn-outline-secondary" href="/">
            <i className="bi bi-arrow-left me-2" />
            Back to Dashboard
          </Link>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <form className="row g-2" onSubmit={saveToken}>
              <div className="col-12 col-md-8">
                <label className="form-label">Bearer Token</label>
                <input
                  className="form-control"
                  value={tempToken}
                  onChange={(event) => setTempToken(event.target.value)}
                  placeholder="Paste API token"
                />
              </div>
              <div className="col-12 col-md-4 d-flex align-items-end">
                <button className="btn btn-primary" type="submit">
                  Save Token
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label">Search</label>
                <input
                  className="form-control"
                  value={filter.search}
                  onChange={(event) => setValue("search", event.target.value)}
                  placeholder="Search action/entity/remarks"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Action</label>
                <input
                  className="form-control"
                  value={filter.action}
                  onChange={(event) => setValue("action", event.target.value)}
                  placeholder="e.g. inventory_posted"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Entity Type</label>
                <input
                  className="form-control"
                  value={filter.entity_type}
                  onChange={(event) => setValue("entity_type", event.target.value)}
                  placeholder="e.g. inventory_transaction"
                />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-12 col-md-3">
                <label className="form-label">Entity ID</label>
                <input
                  className="form-control"
                  value={filter.entity_id}
                  onChange={(event) => setValue("entity_id", event.target.value)}
                  placeholder="numeric entity id"
                  inputMode="numeric"
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">User ID</label>
                <input
                  className="form-control"
                  value={filter.user_id}
                  onChange={(event) => setValue("user_id", event.target.value)}
                  placeholder="numeric user id"
                  inputMode="numeric"
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Date From</label>
                <input
                  className="form-control"
                  type="date"
                  value={filter.date_from}
                  onChange={(event) => setValue("date_from", event.target.value)}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Date To</label>
                <input
                  className="form-control"
                  type="date"
                  value={filter.date_to}
                  onChange={(event) => setValue("date_to", event.target.value)}
                />
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-primary" type="button" onClick={() => void loadRows()}>
                Apply
              </button>
              <button className="btn btn-outline-secondary" type="button" onClick={clearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Entries</h2>
              <small className="text-secondary">{message}</small>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>User</th>
                    <th>Remarks</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-secondary py-4">
                        No audit logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        <td>{log.action}</td>
                        <td>
                          {log.entity_type ?? "-"}
                          {log.entity_id !== null ? ` #${log.entity_id}` : ""}
                        </td>
                        <td>{log.user ? log.user.name : log.user_id ?? "-"}</td>
                        <td className="text-break">{log.remarks ?? "-"}</td>
                        <td>{log.created_at ? log.created_at.slice(0, 10) : "-"}</td>
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
