"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";
import { AssetCreateDialog } from "@/components/ims/AssetCreateDialog";

type AssetLookup = {
  id: number;
  asset_id: string;
  status: string;
  item?: {
    name: string;
  };
  department?: {
    name: string;
  };
  store?: {
    name: string;
  };
  project?: {
    title: string;
    project_code: string;
  };
  serial_number: string;
};

type Department = {
  id: number;
  name: string;
};

const unwrapRows = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }

  return [];
};

export default function LabInventoryPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<AssetLookup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);

  const matchingRows = useMemo(
    () =>
      rows.filter((asset) => {
        const itemName = asset.item?.name?.toLowerCase() ?? "";
        const serial = (asset.serial_number ?? "").toLowerCase();
        const query = search.trim().toLowerCase();
        const isLab =
          itemName.includes("lab") ||
          itemName.includes("chemical") ||
          itemName.includes("laboratory") ||
          serial.includes("lab") ||
          serial.includes("chem");

        if (!isLab) {
          return false;
        }

        if (query && `${asset.asset_id} ${itemName}`.toLowerCase().indexOf(query) === -1) {
          return false;
        }

        if (status && asset.status !== status) {
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
      const response = await api.get("/master-data/departments", authHeaders);
      setDepartments(unwrapRows<Department>(response.data));
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
      const response = await api.get<{ data: AssetLookup[] }>("/assets", {
        ...authHeaders,
        params: {
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(departmentId ? { department_id: departmentId } : {}),
        },
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load laboratory inventory. Verify token and permissions.");
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
          title="Laboratory Inventory"
          subtitle="Scientific consumables and lab assets filtered by keyword profile."
          actions={
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setAssetDialogOpen(true)}>
              <i className="bi bi-plus-lg me-1" />
              Register Lab Asset
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
              placeholder="Lab item or asset code"
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
              <option value="in_use">In Use</option>
              <option value="in_store">In Store</option>
              <option value="issued">Issued</option>
              <option value="damaged">Damaged</option>
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
              render: (row: AssetLookup) => row.item?.name ?? "-",
            },
            { key: "department", header: "Department", render: (row: AssetLookup) => row.department?.name ?? "-" },
            { key: "store", header: "Store", render: (row: AssetLookup) => row.store?.name ?? "-" },
            {
              key: "project",
              header: "Project",
              render: (row: AssetLookup) => row.project?.title || row.project?.project_code || "-",
            },
            {
              key: "status",
              header: "Status",
              render: (row: AssetLookup) => <StatusBadge status={row.status} />,
            },
          ]}
          rows={matchingRows as never}
          empty="No laboratory-like inventory rows found."
        />

        {loading ? <span className="small text-secondary">Loading…</span> : null}

        <AssetCreateDialog
          open={assetDialogOpen}
          title="Register Lab Asset"
          subtitle="Create a lab equipment or laboratory inventory asset record."
          defaults={{ subcategory_code: "LAB", status: "in_store", is_sensitive_controlled: true }}
          onClose={() => setAssetDialogOpen(false)}
          onCreated={loadRows}
        />
      </div>
    </main>
  );
}
