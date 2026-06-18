"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Lookup = {
  id: number;
  name: string;
};

type ProjectAssetRow = {
  id: number;
  asset_id: string;
  serial_number: string;
  item_name: string;
  category_name: string;
  department_name: string;
  store_name: string;
  project_code: string;
  project_title: string;
  status: string;
  condition_status: string;
  is_sensitive_controlled: boolean;
  custodian_name: string;
};

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "in_use", label: "In Use" },
  { value: "disposed", label: "Disposed" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
];

export default function ProjectsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);

  const [projects, setProjects] = useState<Lookup[]>([]);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ProjectAssetRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadLookups = useCallback(async () => {
    if (!authReady) {
      return;
    }

    try {
      const response = await api.get<Lookup[]>("/master-data/research-projects", authHeaders);
      setProjects(response.data);
    } catch {
      setError("Unable to load projects. Verify token and backend connectivity.");
    }
  }, [authHeaders, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.get<{ data: ProjectAssetRow[] }>("/reports/fixed-assets", {
        ...authHeaders,
        params: {
          ...(projectId ? { project_id: projectId } : {}),
          ...(status ? { status } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load project inventory. Verify token and query filters.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, projectId, search, status, authReady]);

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
    setProjectId("");
    setStatus("");
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Research Project Inventory"
          subtitle="Project-linked assets and consumables grouped by project context."
          
        />

        <FilterBar onReset={reset}>
          <div className="col-12 col-lg-4">
            <label className="form-label small mb-1">Search</label>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Asset id, item, project"
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Project</label>
            <select
              className="form-select form-select-sm"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Research project asset register</h2>
          {loading ? <span className="small text-secondary">Loading…</span> : null}
        </div>

        <DataTable
          columns={[
            { key: "asset_id", header: "Asset ID" },
            { key: "project_code", header: "Project" },
            { key: "item_name", header: "Item" },
            { key: "category_name", header: "Category" },
            { key: "department_name", header: "Department" },
            { key: "store_name", header: "Store" },
            { key: "serial_number", header: "Serial No" },
            { key: "custodian_name", header: "Custodian" },
            { key: "status", header: "Status", render: (row: ProjectAssetRow) => <StatusBadge status={row.status} /> },
            { key: "condition_status", header: "Condition" },
            {
              key: "is_sensitive_controlled",
              header: "Sensitive",
              className: "text-center",
              render: (row: ProjectAssetRow) => (row.is_sensitive_controlled ? <i className="bi bi-shield-check text-warning" /> : <span className="text-secondary">—</span>),
            },
          ]}
          rows={rows}
          empty="No project-linked assets found."
        />

        {!authReady ? <div className="alert alert-info mt-3 mb-0">Authentication token required to load live data.</div> : null}
      </div>
    </main>
  );
}
