"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";
import { AssetCreateDialog } from "@/components/ims/AssetCreateDialog";

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);

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
    if (!authReady) {
      return;
    }

    try {
      const response = await api.get<{ data?: Department[] } | Department[]>("/master-data/departments", authHeaders);
      setDepartments(Array.isArray(response.data) ? response.data : response.data?.data ?? []);
    } catch {
      setError("Unable to load departments. Verify token and connection.");
    }
  }, [authHeaders, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) {
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
  }, [authHeaders, departmentId, search, authReady]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

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
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setAssetDialogOpen(true)}>
              <i className="bi bi-plus-lg me-1" />
              Register IT Asset
            </button>
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

        <AssetCreateDialog
          open={assetDialogOpen}
          title="Register IT Asset"
          subtitle="Create an IT equipment asset record with serial, model, location, and custodian details."
          defaults={{ status: "in_store", is_sensitive_controlled: true }}
          onClose={() => setAssetDialogOpen(false)}
          onCreated={loadRows}
        />
      </div>
    </main>
  );
}
