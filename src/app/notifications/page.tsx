"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader } from "@/components/ims";

type NotificationRow = {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  entity_type: string | null;
  entity_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type FilterValues = {
  search: string;
  is_read: string;
  notification_type: string;
};

export default function NotificationsPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(token);
  const authHeaders = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [filters, setFilters] = useState<FilterValues>({ search: "", is_read: "", notification_type: "" });
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    if (!token) return;

    const params: Record<string, string> = {};
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.is_read) params.is_read = filters.is_read;
    if (filters.notification_type.trim()) params.notification_type = filters.notification_type.trim();

    try {
      const response = await api.get<{ data: NotificationRow[] }>("/notifications", {
        ...authHeaders,
        params,
      });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load notifications.");
    }
  }, [authHeaders, token, filters.search, filters.is_read, filters.notification_type]);

  const loadUnread = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get<{ unread_count: number }>("/notifications/unread-count", authHeaders);
      setUnreadCount(Number(response.data?.unread_count ?? 0));
    } catch {
      setUnreadCount(0);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
    void loadUnread();
  }, [loadRows, loadUnread]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
  };

  const setFilter = (key: keyof FilterValues, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const markRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`, {}, authHeaders);
      await loadRows();
      await loadUnread();
    } catch {
      setError("Unable to mark notification as read.");
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all", {}, authHeaders);
      await loadRows();
      await loadUnread();
    } catch {
      setError("Unable to mark all notifications.");
    }
  };

  const columns = [
    { key: "title", header: "Title" },
    { key: "notification_type", header: "Type" },
    { key: "message", header: "Message" },
    {
      key: "is_read",
      header: "Status",
      render: (row: NotificationRow) => <span className={row.is_read ? "text-secondary" : "badge text-bg-danger"}>{row.is_read ? "Read" : "Unread"}</span>,
    },
    { key: "entity_type", header: "Entity" },
    { key: "created_at", header: "Created" },
    {
      key: "action",
      header: "Action",
      render: (row: NotificationRow) =>
        row.is_read ? (
          <span className="small text-secondary">—</span>
        ) : (
          <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => markRead(row.id)}>
            <i className="bi bi-check2 me-1" />
            Mark Read
          </button>
        ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="In-App Notifications"
          subtitle={`Unread: ${unreadCount}`}
          actions={
            <form className="d-flex gap-2" onSubmit={submitToken}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-key" />
                </span>
                <input
                  className="form-control"
                  value={tmpToken}
                  placeholder="Bearer token"
                  onChange={(event) => setTmpToken(event.target.value)}
                />
              </div>
              <button className="btn btn-sm btn-outline-primary" type="submit">
                Save token
              </button>
            </form>
          }
        />

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <FilterBar onReset={() => setFilters({ search: "", is_read: "", notification_type: "" })}>
          <div className="col-12 col-lg-4">
            <label className="form-label small mb-1">Search</label>
            <input
              className="form-control form-control-sm"
              value={filters.search}
              onChange={(event) => setFilter("search", event.target.value)}
              placeholder="Title/message"
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Read Status</label>
            <select
              className="form-select form-select-sm"
              value={filters.is_read}
              onChange={(event) => setFilter("is_read", event.target.value)}
            >
              <option value="">All</option>
              <option value="0">Unread</option>
              <option value="1">Read</option>
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Type</label>
            <input
              className="form-control form-control-sm"
              value={filters.notification_type}
              onChange={(event) => setFilter("notification_type", event.target.value)}
              placeholder="e.g. approval"
            />
          </div>
          <div className="col-12 col-lg-2 d-grid">
            <label className="form-label small mb-1 opacity-0">Refresh</label>
            <button className="btn btn-outline-primary btn-sm" type="button" onClick={markAllRead}>
              <i className="bi bi-check-all me-1" />
              Mark All Read
            </button>
          </div>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState title="No notifications found" icon="bi-bell" message="No in-app notifications match your filters." />
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}
      </div>
    </main>
  );
}
