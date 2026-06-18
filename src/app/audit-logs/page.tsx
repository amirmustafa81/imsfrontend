"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, Timeline } from "@/components/ims";

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), [authReady]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<FilterState>(initialFilter);
  const [message, setMessage] = useState("Load audit logs to continue.");
  const [error, setError] = useState("");

  const timelineEvents = useMemo(
    () =>
      logs
        .slice(0, 12)
        .map((log) => ({
          at: log.created_at ? log.created_at.slice(0, 16).replace("T", " ") : "-",
          actor: log.user?.name ?? (log.user_id ? `User ${log.user_id}` : "System"),
          action: log.action,
          detail: log.entity_type
            ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ""}${log.remarks ? ` - ${log.remarks}` : ""}`
            : log.remarks ?? "",
        })),
    [logs],
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
    if (!authReady) return;

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
  }, [authHeaders, buildParams, authReady]);

  useEffect(() => {
    void (async () => {
      await loadRows();
    })();
  }, [loadRows]);

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

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Entries</h2>
              <small className="text-secondary">{message}</small>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}

            <DataTable columns={tableColumns as never} rows={logs as never} />
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h2 className="h5 mb-3">Timeline</h2>
            {timelineEvents.length > 0 ? <Timeline events={timelineEvents} /> : <div className="text-secondary small">No timeline events yet.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
