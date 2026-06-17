"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, PageHeader } from "@/components/ims";

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

const tableColumns = [
  { key: "id", header: "ID" },
  { key: "action", header: "Action" },
  {
    key: "entity",
    header: "Entity",
    render: (row: AuditLog) => {
      if (!row.entity_type) return "-";
      return row.entity_id ? `${row.entity_type} #${row.entity_id}` : row.entity_type;
    },
  },
  {
    key: "user",
    header: "User",
    render: (row: AuditLog) => (row.user ? row.user.name : row.user_id ?? "-"),
  },
  { key: "remarks", header: "Remarks", className: "text-break" },
  {
    key: "created_at",
    header: "Created At",
    render: (row: AuditLog) => (row.created_at ? row.created_at.slice(0, 10) : "-"),
  },
] as const;

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
        <PageHeader
          title="Audit Logs"
          subtitle="Track all auditable inventory actions with filters."
          actions={
            <form onSubmit={saveToken} className="d-flex gap-2 align-items-end">
              <div>
                <label className="form-label small mb-1">Bearer Token</label>
                <input
                  className="form-control form-control-sm"
                  value={tempToken}
                  onChange={(event) => setTempToken(event.target.value)}
                  placeholder="Paste API token"
                />
              </div>
              <button className="btn btn-primary" type="submit">
                Save Token
              </button>
            </form>
          }
        />

        <FilterBar onReset={clearFilters}>
          <div className="col-12 col-md-4">
            <label className="form-label small">Search</label>
            <input
              className="form-control form-control-sm"
              value={filter.search}
              onChange={(event) => setValue("search", event.target.value)}
              placeholder="Search action/entity/remarks"
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Action</label>
            <input
              className="form-control form-control-sm"
              value={filter.action}
              onChange={(event) => setValue("action", event.target.value)}
              placeholder="e.g. inventory_posted"
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Entity Type</label>
            <input
              className="form-control form-control-sm"
              value={filter.entity_type}
              onChange={(event) => setValue("entity_type", event.target.value)}
              placeholder="e.g. inventory_transaction"
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small">Entity ID</label>
            <input
              className="form-control form-control-sm"
              value={filter.entity_id}
              onChange={(event) => setValue("entity_id", event.target.value)}
              placeholder="numeric entity id"
              inputMode="numeric"
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small">User ID</label>
            <input
              className="form-control form-control-sm"
              value={filter.user_id}
              onChange={(event) => setValue("user_id", event.target.value)}
              placeholder="numeric user id"
              inputMode="numeric"
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small">Date From</label>
            <input
              className="form-control form-control-sm"
              type="date"
              value={filter.date_from}
              onChange={(event) => setValue("date_from", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small">Date To</label>
            <input
              className="form-control form-control-sm"
              type="date"
              value={filter.date_to}
              onChange={(event) => setValue("date_to", event.target.value)}
            />
          </div>
          <div className="col-auto">
            <button className="btn btn-sm btn-primary" type="button" onClick={() => void loadRows()}>
              Apply
            </button>
          </div>
        </FilterBar>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Entries</h2>
              <small className="text-secondary">{message}</small>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}

            <DataTable columns={tableColumns as never} rows={logs as never} />
          </div>
        </div>
      </div>
    </main>
  );
}
