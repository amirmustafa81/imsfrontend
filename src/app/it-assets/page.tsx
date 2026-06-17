"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type AssetRow = {
  id: number;
  asset_id: string;
  serial_number: string;
  status: string;
  is_sensitive_controlled: boolean;
  item: {
    name: string;
  };
  model: string;
  department: {
    name: string;
  };
  store: {
    name: string;
  };
  building: {
    name: string;
  };
  room: {
    name: string;
  };
  custodian_user_id: number;
  custodian_user: {
    name: string;
  };
};

type Department = {
  id: number;
  name: string;
};

export default function ItAssetsPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tempToken, setTempToken] = useState(token);
  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const itRows = useMemo(
    () =>
      rows.filter((row) => {
        const itemName = row.item?.name?.toLowerCase() ?? "";
        const searchText = search.trim().toLowerCase();
        const tags = `${row.asset_id} ${itemName} ${row.model ?? ""} ${row.status}`.toLowerCase();
        const isIt =
          itemName.includes("computer") ||
          itemName.includes("router") ||
          itemName.includes("network") ||
          itemName.includes("switch") ||
          itemName.includes("server") ||
          itemName.includes("it") ||
          itemName.includes("laptop") ||
          itemName.includes("printer") ||
          itemName.includes("desktop");

        if (!isIt) {
          return false;
        }

        if (searchText && tags.indexOf(searchText) === -1) {
          return false;
        }

        if (status && row.status !== status) {
          return false;
        }

        return true;
      }),
    [rows, search, status],
  );

  const loadLookups = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.get<Department[]>("/master-data/departments", authHeaders);
      setDepartments(response.data);
    } catch {
      setError("Unable to load departments. Verify token and connection.");
    }
  }, [authHeaders, token]);

  const loadRows = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ data: AssetRow[] }>("/assets", {
        ...authHeaders,
        params: {
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(departmentId ? { department_id: departmentId } : {}),
        },
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load IT assets. Verify token and permissions.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, departmentId, search, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tempToken);
    setToken(tempToken);
  };

  const reset = () => {
    setSearch("");
    setDepartmentId("");
    setStatus("");
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="IT Assets"
          subtitle="IT-focused fixed assets and serialised devices for department operations."
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
          <div className="col-12 col-lg-4">
            <label className="form-label small mb-1">Search</label>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Asset, item, model"
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Department</label>
            <select
              className="form-select form-select-sm"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="in_store">In Store</option>
              <option value="issued">Issued</option>
              <option value="in_use">In Use</option>
              <option value="under_repair">Under Repair</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <DataTable
          columns={[
            { key: "asset_id", header: "Asset ID" },
            { key: "serial_number", header: "Serial" },
            {
              key: "item_name",
              header: "Item",
              render: (row: AssetRow) => row.item?.name ?? "-",
            },
            { key: "model", header: "Model" },
            {
              key: "department",
              header: "Department",
              render: (row: AssetRow) => row.department?.name ?? "-",
            },
            {
              key: "custodian",
              header: "Custodian",
              render: (row: AssetRow) => row.custodian_user?.name ?? "-",
            },
            { key: "status", header: "Status", render: (row: AssetRow) => <StatusBadge status={row.status} /> },
            {
              key: "sensitivity",
              header: "Sensitive",
              className: "text-center",
              render: (row: AssetRow) => (row.is_sensitive_controlled ? <i className="bi bi-shield-check text-warning" /> : <span className="text-secondary">—</span>),
            },
          ]}
          rows={itRows}
          empty="No IT assets found."
        />

        {loading ? <span className="small text-secondary">Loading…</span> : null}
      </div>
    </main>
  );
}
